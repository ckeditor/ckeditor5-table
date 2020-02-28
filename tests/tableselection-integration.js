/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals document */

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import TableEditing from '../src/tableediting';
import TableSelection from '../src/tableselection';
import { modelTable } from './_utils/utils';
import { assertEqualMarkup } from '@ckeditor/ckeditor5-utils/tests/_utils/utils';
import DomEventData from '@ckeditor/ckeditor5-engine/src/view/observer/domeventdata';
import Delete from '@ckeditor/ckeditor5-typing/src/delete';
import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import { getCode } from '@ckeditor/ckeditor5-utils/src/keyboard';
import Input from '@ckeditor/ckeditor5-typing/src/input';
import ViewText from '@ckeditor/ckeditor5-engine/src/view/text';
import UndoEditing from '@ckeditor/ckeditor5-undo/src/undoediting';

describe( 'table selection', () => {
	let editor, model, tableSelection, modelRoot, element, viewDocument;

	describe( 'TableSelection - input integration', () => {
		afterEach( async () => {
			element.remove();
			await editor.destroy();
		} );

		describe( 'on delete', () => {
			beforeEach( async () => {
				await setupEditor( [ Delete ] );
			} );

			it( 'should clear contents of the selected table cells and put selection in last cell on backward delete', () => {
				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				const domEventData = new DomEventData( viewDocument, {
					preventDefault: sinon.spy()
				}, {
					direction: 'backward',
					unit: 'character',
					sequence: 1
				} );
				viewDocument.fire( 'delete', domEventData );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ '', '', '13' ],
					[ '', '[]', '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );

			it( 'should clear contents of the selected table cells and put selection in last cell on forward delete', () => {
				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				const domEventData = new DomEventData( viewDocument, {
					preventDefault: sinon.spy()
				}, {
					direction: 'forward',
					unit: 'character',
					sequence: 1
				} );
				viewDocument.fire( 'delete', domEventData );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ '[]', '', '13' ],
					[ '', '', '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );

			it( 'should not interfere with default key handler if no table selection', () => {
				setModelData( model, modelTable( [
					[ '11[]', '12', '13' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				] ) );

				const domEventData = new DomEventData( viewDocument, {
					preventDefault: sinon.spy()
				}, {
					direction: 'backward',
					unit: 'character',
					sequence: 1
				} );
				viewDocument.fire( 'delete', domEventData );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ '1[]', '12', '13' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );
		} );

		describe( 'on user input', () => {
			beforeEach( async () => {
				await setupEditor( [ Input ] );
			} );

			it( 'should clear contents of the selected table cells and put selection in last cell on user input', () => {
				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				viewDocument.fire( 'keydown', { keyCode: getCode( 'x' ) } );

				//                                      figure       table         tbody         tr            td            span
				const viewSpan = viewDocument.getRoot().getChild( 0 ).getChild( 1 ).getChild( 0 ).getChild( 1 ).getChild( 1 ).getChild( 0 );

				viewDocument.fire( 'mutations', [
					{
						type: 'children',
						oldChildren: [],
						newChildren: [ new ViewText( 'x' ) ],
						node: viewSpan
					}
				] );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ '', '', '13' ],
					[ '', 'x[]', '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );

			it( 'should not interfere with default key handler if no table selection', () => {
				viewDocument.fire( 'keydown', { keyCode: getCode( 'x' ) } );

				//                                      figure       table         tbody         tr            td            span
				const viewSpan = viewDocument.getRoot().getChild( 0 ).getChild( 1 ).getChild( 0 ).getChild( 0 ).getChild( 0 ).getChild( 0 );

				viewDocument.fire( 'mutations', [
					{
						type: 'children',
						oldChildren: [],
						newChildren: [ new ViewText( 'x' ) ],
						node: viewSpan
					}
				] );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ 'x[]11', '12', '13' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );
		} );
	} );

	describe( 'TableSelection - undo integration', () => {
		afterEach( async () => {
			element.remove();
			await editor.destroy();
		} );

		describe( 'on undo', () => {
			beforeEach( async () => {
				await setupEditor( [ Input, UndoEditing ] );
			} );

			it( 'should clear contents of the selected table cells and put selection in last cell on backward delete', () => {
				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				const node = modelRoot.getNodeByPath( [ 0, 0, 0, 0 ] );
				editor.execute( 'input', {
					text: 'foobar',
					range: model.createRangeIn( modelRoot.getNodeByPath( [ 0, 0, 0, 0 ] ) ),
					resultRange: model.createRange(
						model.createPositionAt( node, 0 ),
						model.createPositionAt( node, 0 )
					)
				} );

				assertEqualMarkup( getModelData( model, { withoutSelection: true } ), modelTable( [
					[ 'foobar', '12', '13' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				] ) );

				editor.execute( 'undo' );

				assertEqualMarkup( getModelData( model ), modelTable( [
					[ { contents: '11', isSelected: true }, { contents: '12', isSelected: true }, '13' ],
					[ { contents: '21', isSelected: true }, { contents: '22', isSelected: true }, '23' ],
					[ '31', '32', '33' ]
				] ) );
			} );
		} );
	} );

	async function setupEditor( plugins ) {
		element = document.createElement( 'div' );
		document.body.appendChild( element );

		editor = await ClassicTestEditor.create( element, {
			plugins: [ TableEditing, TableSelection, Paragraph, ...plugins ]
		} );

		model = editor.model;
		modelRoot = model.document.getRoot();
		viewDocument = editor.editing.view.document;
		tableSelection = editor.plugins.get( TableSelection );

		setModelData( model, modelTable( [
			[ '[]11', '12', '13' ],
			[ '21', '22', '23' ],
			[ '31', '32', '33' ]
		] ) );
	}
} );
