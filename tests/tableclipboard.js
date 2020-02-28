/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import TableEditing from '../src/tableediting';
import { modelTable, viewTable } from './_utils/utils';
import Clipboard from '@ckeditor/ckeditor5-clipboard/src/clipboard';
import TableClipboard from '../src/tableclipboard';
import { assertEqualMarkup } from '@ckeditor/ckeditor5-utils/tests/_utils/utils';

describe( 'table clipboard', () => {
	let editor, model, modelRoot, tableSelection, viewDocument;

	beforeEach( async () => {
		editor = await VirtualTestEditor.create( {
			plugins: [ TableEditing, TableClipboard, Paragraph, Clipboard ]
		} );

		model = editor.model;
		modelRoot = model.document.getRoot();
		viewDocument = editor.editing.view.document;
		tableSelection = editor.plugins.get( 'TableSelection' );

		setModelData( model, modelTable( [
			[ '00[]', '01', '02' ],
			[ '10', '11', '12' ],
			[ '20', '21', '22' ]
		] ) );
	} );

	afterEach( async () => {
		await editor.destroy();
	} );

	describe( 'Clipboard integration', () => {
		describe( 'copy', () => {
			it( 'should do nothing for normal selection in table', () => {
				const dataTransferMock = createDataTransfer();
				const spy = sinon.spy();

				viewDocument.on( 'clipboardOutput', spy );

				viewDocument.fire( 'copy', {
					dataTransfer: dataTransferMock,
					preventDefault: sinon.spy()
				} );

				sinon.assert.calledOnce( spy );
			} );

			it( 'should copy selected table cells as a standalone table', () => {
				const preventDefaultSpy = sinon.spy();

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				const data = {
					dataTransfer: createDataTransfer(),
					preventDefault: preventDefaultSpy
				};
				viewDocument.fire( 'copy', data );

				sinon.assert.calledOnce( preventDefaultSpy );
				expect( data.dataTransfer.getData( 'text/html' ) ).to.equal( viewTable( [
					[ '01', '02' ],
					[ '11', '12' ]
				] ) );
			} );

			it( 'should trim selected table to a selection rectangle (inner cell with colspan, no colspan after trim)', () => {
				setModelData( model, modelTable( [
					[ '00[]', '01', '02' ],
					[ '10', { contents: '11', colspan: 2 } ],
					[ '20', '21', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 1 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '00', '01' ],
					[ '10', '11' ],
					[ '20', '21' ]
				] ) );
			} );

			it( 'should trim selected table to a selection rectangle (inner cell with colspan, has colspan after trim)', () => {
				setModelData( model, modelTable( [
					[ '00[]', '01', '02' ],
					[ { contents: '10', colspan: 3 } ],
					[ '20', '21', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 1 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '00', '01' ],
					[ { contents: '10', colspan: 2 } ],
					[ '20', '21' ]
				] ) );
			} );

			it( 'should trim selected table to a selection rectangle (inner cell with rowspan, no colspan after trim)', () => {
				setModelData( model, modelTable( [
					[ '00[]', '01', '02' ],
					[ '10', { contents: '11', rowspan: 2 }, '12' ],
					[ '20', '21', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				] ) );
			} );

			it( 'should trim selected table to a selection rectangle (inner cell with rowspan, has rowspan after trim)', () => {
				setModelData( model, modelTable( [
					[ '00[]', { contents: '01', rowspan: 3 }, '02' ],
					[ '10', '12' ],
					[ '20', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '00', { contents: '01', rowspan: 2 }, '02' ],
					[ '10', '12' ]
				] ) );
			} );

			it( 'should prepend spanned columns with empty cells (outside cell with colspan)', () => {
				setModelData( model, modelTable( [
					[ '00[]', '01', '02' ],
					[ { contents: '10', colspan: 2 }, '12' ],
					[ '20', '21', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 2 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '01', '02' ],
					[ '&nbsp;', '12' ],
					[ '21', '22' ]
				] ) );
			} );

			it( 'should prepend spanned columns with empty cells (outside cell with rowspan)', () => {
				setModelData( model, modelTable( [
					[ '00[]', { contents: '01', rowspan: 2 }, '02' ],
					[ '10', '12' ],
					[ '20', '21', '22' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 1, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 2 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '10', '&nbsp;', '12' ],
					[ '20', '21', '22' ]
				] ) );
			} );

			it( 'should fix selected table to a selection rectangle (hardcore case)', () => {
				// This test check how previous simple rules run together (mixed prepending and trimming).
				// In the example below a selection is set from cell "32" to "88"
				//
				//                    Input table:                                         Copied table:
				//
				//   +----+----+----+----+----+----+----+----+----+
				//   | 00 | 01 | 02 | 03 | 04      | 06 | 07 | 08 |
				//   +----+----+    +----+         +----+----+----+
				//   | 10 | 11 |    | 13 |         | 16 | 17 | 18 |
				//   +----+----+    +----+         +----+----+----+             +----+----+----+---------+----+----+
				//   | 20 | 21 |    | 23 |         | 26           |             | 21 |    | 23 |    |    | 26 |    |
				//   +----+----+    +----+         +----+----+----+             +----+----+----+----+----+----+----+
				//   | 30 | 31 |    | 33 |         | 36 | 37      |             | 31 |    | 33 |    |    | 36 | 37 |
				//   +----+----+----+----+         +----+----+----+             +----+----+----+----+----+----+----+
				//   | 40                |         | 46 | 47 | 48 |             |    |    |    |    |    | 46 | 47 |
				//   +----+----+----+----+         +----+----+----+     ==>     +----+----+----+----+----+----+----+
				//   | 50 | 51 | 52 | 53 |         | 56 | 57 | 58 |             | 51 | 52 | 53 |    |    | 56 | 57 |
				//   +----+----+----+----+----+----+    +----+----+             +----+----+----+----+----+----+----+
				//   | 60 | 61           | 64 | 65 |    | 67 | 68 |             | 61 |    |    | 64 | 65 |    | 67 |
				//   +----+----+----+----+----+----+    +----+----+             +----+----+----+----+----+----+----+
				//   | 70 | 71 | 72 | 73 | 74 | 75 |    | 77 | 78 |             | 71 | 72 | 73 | 74 | 75 |    | 77 |
				//   +----+    +----+----+----+----+    +----+----+             +----+----+----+----+----+----+----+
				//   | 80 |    | 82 | 83 | 84 | 85 |    | 87 | 88 |
				//   +----+----+----+----+----+----+----+----+----+
				//
				setModelData( model, modelTable( [
					[ '00', '01', { contents: '02', rowspan: 4 }, '03', { contents: '04', colspan: 2, rowspan: 7 }, '07', '07', '08' ],
					[ '10', '11', '13', '17', '17', '18' ],
					[ '20', '21', '23', { contents: '27', colspan: 3 } ],
					[ '30', '31', '33', '37', { contents: '37', colspan: 2 } ],
					[ { contents: '40', colspan: 4 }, '47', '47', '48' ],
					[ '50', '51', '52', '53', { contents: '57', rowspan: 4 }, '57', '58' ],
					[ '60', { contents: '61', colspan: 3 }, '67', '68' ],
					[ '70', { contents: '71', rowspan: 2 }, '72', '73', '74', '75', '77', '78' ],
					[ '80', '82', '83', '84', '85', '87', '88' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 2, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 7, 6 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '21', '&nbsp;', '23', '&nbsp;', '&nbsp;', { contents: '27', colspan: 2 } ],
					[ '31', '&nbsp;', '33', '&nbsp;', '&nbsp;', '37', '37' ],
					[ '&nbsp;', '&nbsp;', '&nbsp;', '&nbsp;', '&nbsp;', '47', '47' ],
					[ '51', '52', '53', '&nbsp;', '&nbsp;', { contents: '57', rowspan: 3 }, '57' ],
					[ { contents: '61', colspan: 3 }, '&nbsp;', '&nbsp;', '&nbsp;', '67' ],
					[ '71', '72', '73', '74', '75', '77' ]
				] ) );
			} );

			it( 'should update table heading attributes (selection with headings)', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02', '03', '04' ],
					[ '10', '11', '12', '13', '14' ],
					[ '20', '21', '22', '23', '24' ],
					[ '30', '31', '32', '33', '34' ],
					[ '40', '41', '42', '43', '44' ]
				], { headingRows: 3, headingColumns: 2 } ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 3, 3 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '11', '12', '13' ],
					[ '21', '22', '23' ],
					[ { contents: '31', isHeading: true }, '32', '33' ] // TODO: bug in viewTable
				], { headingRows: 2, headingColumns: 1 } ) );
			} );

			it( 'should update table heading attributes (selection without headings)', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02', '03', '04' ],
					[ '10', '11', '12', '13', '14' ],
					[ '20', '21', '22', '23', '24' ],
					[ '30', '31', '32', '33', '34' ],
					[ '40', '41', '42', '43', '44' ]
				], { headingRows: 3, headingColumns: 2 } ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 3, 2 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 4, 4 ] ) );

				assertClipboardContentOnMethod( 'copy', viewTable( [
					[ '32', '33', '34' ],
					[ '42', '43', '44' ]
				] ) );
			} );
		} );

		describe( 'cut', () => {
			it( 'should not block clipboardOutput if no multi-cell selection', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ],
					[ '20', '21', '22' ]
				] ) );

				const dataTransferMock = createDataTransfer();

				viewDocument.fire( 'cut', {
					dataTransfer: dataTransferMock,
					preventDefault: sinon.spy()
				} );

				expect( dataTransferMock.getData( 'text/html' ) ).to.equal( '00' );
			} );

			it( 'should be preventable', () => {
				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				viewDocument.on( 'clipboardOutput', evt => evt.stop(), { priority: 'high' } );

				viewDocument.fire( 'cut', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ { contents: '00', isSelected: true }, { contents: '01', isSelected: true }, '02' ],
					[ { contents: '10', isSelected: true }, { contents: '11', isSelected: true }, '12' ],
					[ '20', '21', '22' ]
				] ) );
			} );

			it( 'is clears selected table cells', () => {
				const spy = sinon.spy();

				viewDocument.on( 'clipboardOutput', spy );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				viewDocument.fire( 'cut', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ '', '', '02' ],
					[ '', '[]', '12' ],
					[ '20', '21', '22' ]
				] ) );
			} );

			it( 'should copy selected table cells as a standalone table', () => {
				const preventDefaultSpy = sinon.spy();

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				const data = {
					dataTransfer: createDataTransfer(),
					preventDefault: preventDefaultSpy
				};
				viewDocument.fire( 'cut', data );

				sinon.assert.calledOnce( preventDefaultSpy );
				expect( data.dataTransfer.getData( 'text/html' ) ).to.equal( viewTable( [
					[ '01', '02' ],
					[ '11', '12' ]
				] ) );
			} );
		} );
	} );

	function assertClipboardContentOnMethod( method, expectedViewTable ) {
		const data = {
			dataTransfer: createDataTransfer(),
			preventDefault: sinon.spy()
		};
		viewDocument.fire( method, data );

		expect( data.dataTransfer.getData( 'text/html' ) ).to.equal( expectedViewTable );
	}

	function createDataTransfer() {
		const store = new Map();

		return {
			setData( type, data ) {
				store.set( type, data );
			},

			getData( type ) {
				return store.get( type );
			}
		};
	}
} );
