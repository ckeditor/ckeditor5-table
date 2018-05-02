/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ModelTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor';
import { setData, getData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { upcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';

import MergeCellCommand from '../../src/commands/mergecellcommand';
import { downcastInsertTable } from '../../src/converters/downcast';
import upcastTable from '../../src/converters/upcasttable';
import { formatTable, formattedModelTable, modelTable } from '../_utils/utils';

describe( 'MergeCellCommand', () => {
	let editor, model, command, root;

	beforeEach( () => {
		return ModelTestEditor.create()
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				root = model.document.getRoot( 'main' );

				const conversion = editor.conversion;
				const schema = model.schema;

				schema.register( 'table', {
					allowWhere: '$block',
					allowAttributes: [ 'headingRows' ],
					isBlock: true,
					isObject: true
				} );

				schema.register( 'tableRow', {
					allowIn: 'table',
					allowAttributes: [],
					isBlock: true,
					isLimit: true
				} );

				schema.register( 'tableCell', {
					allowIn: 'tableRow',
					allowContentOf: '$block',
					allowAttributes: [ 'colspan', 'rowspan' ],
					isBlock: true,
					isLimit: true
				} );

				model.schema.register( 'p', { inheritAllFrom: '$block' } );

				// Table conversion.
				conversion.for( 'upcast' ).add( upcastTable() );
				conversion.for( 'downcast' ).add( downcastInsertTable() );

				// Table row upcast only since downcast conversion is done in `downcastTable()`.
				conversion.for( 'upcast' ).add( upcastElementToElement( { model: 'tableRow', view: 'tr' } ) );

				// Table cell conversion.
				conversion.for( 'upcast' ).add( upcastElementToElement( { model: 'tableCell', view: 'td' } ) );
				conversion.for( 'upcast' ).add( upcastElementToElement( { model: 'tableCell', view: 'th' } ) );

				conversion.attributeToAttribute( { model: 'colspan', view: 'colspan' } );
				conversion.attributeToAttribute( { model: 'rowspan', view: 'rowspan' } );
			} );
	} );

	afterEach( () => {
		return editor.destroy();
	} );

	describe( 'direction=right', () => {
		beforeEach( () => {
			command = new MergeCellCommand( editor, { direction: 'right' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be true if in cell that has sibling on the right', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if last cell of a row', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in a cell that has sibling on the right with the same rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00[]' }, { rowspan: 2, contents: '01' } ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in a cell that has sibling but with different rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00[]' }, { rowspan: 3, contents: '01' } ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be false if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.isEnabled ).to.be.false;
			} );
		} );

		describe( 'value', () => {
			it( 'should be set to mergeable sibling if in cell that has sibling on the right', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 1 ] ) );
			} );

			it( 'should be undefined if last cell of a row', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be set to mergeable sibling if in a cell that has sibling on the right with the same rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00[]' }, { rowspan: 2, contents: '01' } ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 1 ] ) );
			} );

			it( 'should be undefined if in a cell that has sibling but with different rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00[]' }, { rowspan: 3, contents: '01' } ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be undefined if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.value ).to.be.undefined;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should merge table cells ', () => {
				setData( model, modelTable( [
					[ '[]00', '01' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ { colspan: 2, contents: '[0001]' } ]
				] ) );
			} );
		} );
	} );

	describe( 'direction=left', () => {
		beforeEach( () => {
			command = new MergeCellCommand( editor, { direction: 'left' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be true if in cell that has sibling on the left', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if first cell of a row', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in a cell that has sibling on the left with the same rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00' }, { rowspan: 2, contents: '01[]' } ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in a cell that has sibling but with different rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00' }, { rowspan: 3, contents: '01[]' } ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be false if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.isEnabled ).to.be.false;
			} );
		} );

		describe( 'value', () => {
			it( 'should be set to mergeable sibling if in cell that has sibling on the left', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 0 ] ) );
			} );

			it( 'should be undefined if first cell of a row', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be set to mergeable sibling if in a cell that has sibling on the left with the same rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00' }, { rowspan: 2, contents: '01[]' } ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 0 ] ) );
			} );

			it( 'should be undefined if in a cell that has sibling but with different rowspan', () => {
				setData( model, modelTable( [
					[ { rowspan: 2, contents: '00' }, { rowspan: 3, contents: '01[]' } ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be undefined if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.value ).to.be.undefined;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should merge table cells ', () => {
				setData( model, modelTable( [
					[ '00', '[]01' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ { colspan: 2, contents: '[0001]' } ]
				] ) );
			} );
		} );
	} );

	describe( 'direction=down', () => {
		beforeEach( () => {
			command = new MergeCellCommand( editor, { direction: 'down' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be true if in cell that has mergeable cell in next row', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ],
					[ '10', '11' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in last row', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in a cell that has mergeable cell with the same colspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00[]' }, '02' ],
					[ { colspan: 2, contents: '01' }, '12' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in a cell that potential mergeable cell has different colspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00[]' }, '02' ],
					[ { colspan: 3, contents: '01' } ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be false if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.isEnabled ).to.be.false;
			} );
		} );

		describe( 'value', () => {
			it( 'should be set to mergeable cell', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ],
					[ '10', '11' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 1, 1 ] ) );
			} );

			it( 'should be undefined if in last row', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10[]', '11' ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be set to mergeable cell with the same rowspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00[]' }, '02' ],
					[ { colspan: 2, contents: '01' }, '12' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 1, 0 ] ) );
			} );

			it( 'should be undefined if in a cell that potential mergeable cell has different rowspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00[]' }, '02' ],
					[ { colspan: 3, contents: '01' } ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be undefined if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.value ).to.be.undefined;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should merge table cells ', () => {
				setData( model, modelTable( [
					[ '00', '01[]' ],
					[ '10', '11' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '00', { rowspan: 2, contents: '[0111]' } ],
					[ '10' ]
				] ) );
			} );
		} );
	} );

	describe( 'direction=up', () => {
		beforeEach( () => {
			command = new MergeCellCommand( editor, { direction: 'up' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be true if in cell that has mergeable cell in previous row', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10', '11[]' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in first row', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in a cell that has mergeable cell with the same colspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00' }, '02' ],
					[ { colspan: 2, contents: '01[]' }, '12' ]
				] ) );

				expect( command.isEnabled ).to.be.true;
			} );

			it( 'should be false if in a cell that potential mergeable cell has different colspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00' }, '02' ],
					[ { colspan: 3, contents: '01[]' } ]
				] ) );

				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be false if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.isEnabled ).to.be.false;
			} );
		} );

		describe( 'value', () => {
			it( 'should be set to mergeable cell', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10', '11[]' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 1 ] ) );
			} );

			it( 'should be undefined if in first row', () => {
				setData( model, modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be set to mergeable cell with the same rowspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00' }, '02' ],
					[ { colspan: 2, contents: '01[]' }, '12' ]
				] ) );

				expect( command.value ).to.equal( root.getNodeByPath( [ 0, 0, 0 ] ) );
			} );

			it( 'should be undefined if in a cell that potential mergeable cell has different rowspan', () => {
				setData( model, modelTable( [
					[ { colspan: 2, contents: '00' }, '02' ],
					[ { colspan: 3, contents: '01[]' } ]
				] ) );

				expect( command.value ).to.be.undefined;
			} );

			it( 'should be undefined if not in a cell', () => {
				setData( model, '<p>11[]</p>' );

				expect( command.value ).to.be.undefined;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should merge table cells ', () => {
				setData( model, modelTable( [
					[ '00', '01' ],
					[ '10', '11[]' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '00', { rowspan: 2, contents: '[0111]' } ],
					[ '10' ]
				] ) );
			} );
		} );
	} );
} );