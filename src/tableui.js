/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/tableui
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { addListToDropdown, createDropdown } from '@ckeditor/ckeditor5-ui/src/dropdown/utils';
import Model from '@ckeditor/ckeditor5-ui/src/model';
import Collection from '@ckeditor/ckeditor5-utils/src/collection';

import tableIcon from './../theme/icons/table.svg';
import tableColumnIcon from './../theme/icons/table-column.svg';
import tableRowIcon from './../theme/icons/table-row.svg';
import tableMergeCellIcon from './../theme/icons/table-merge-cell.svg';
import tableSplitCellIcon from './../theme/icons/table-split-cell.svg';

import View from '@ckeditor/ckeditor5-ui/src/view';
import FocusTracker from '../../ckeditor5-utils/src/focustracker';
import FocusCycler from '../../ckeditor5-ui/src/focuscycler';

// TODO RENAME & Split
import './../theme/table.css';

class TableSizeChooser extends View {
	constructor( locale ) {
		super( locale );

		const bind = this.bindTemplate;

		this.set( 'isOn', false );

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [
					'ck-table-size-choose-box',
					bind.if( 'isOn', 'ck-on' )
				]
			},
			on: {
				mouseover: bind.to( 'over' )
			}
		} );
	}
}

class TableSizeView extends View {
	/**
	 * @inheritDoc
	 */
	constructor( locale ) {
		super( locale );

		const bind = this.bindTemplate;

		/**
		 * Collection of the toolbar items (like buttons).
		 *
		 * @readonly
		 * @member {module:ui/viewcollection~ViewCollection}
		 */
		this.items = this.createCollection();

		/**
		 * Tracks information about DOM focus in the list.
		 *
		 * @readonly
		 * @member {module:utils/focustracker~FocusTracker}
		 */
		this.focusTracker = new FocusTracker();

		this.set( 'rows', 0 );
		this.set( 'columns', 0 );

		/**
		 * Helps cycling over focusable {@link #items} in the toolbar.
		 *
		 * @readonly
		 * @protected
		 * @member {module:ui/focuscycler~FocusCycler}
		 */
		this._focusCycler = new FocusCycler( {
			focusables: this.items,
			focusTracker: this.focusTracker,
			keystrokeHandler: this.keystrokes,
			actions: {
				// Navigate toolbar items backwards using the arrow[left,up] keys.
				focusPrevious: [ 'arrowleft', 'arrowup' ],

				// Navigate toolbar items forwards using the arrow[right,down] keys.
				focusNext: [ 'arrowright', 'arrowdown' ]
			}
		} );

		this.bind( 'size' )
			.to( this, 'columns', this, 'rows', ( columns, rows ) => `${ rows } x ${ columns }` );

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [
					'ck',
					bind.if( 'isVertical', 'ck-toolbar_vertical' ),
					bind.to( 'className' )
				]
			},

			children: [
				{
					tag: 'div',
					attributes: {
						class: [ 'ck-table-size-choose-box-container' ]
					},
					children: this.items
				},
				{
					tag: 'div',
					attributes: {
						class: [ 'ck-table-size-label' ]
					},
					children: [
						{ text: bind.to( 'size' ) }
					]
				}
			],

			on: {
				click: bind.to( () => {
					this.fire( 'execute' );
				} )
			}
		} );

		for ( let i = 0; i < 100; i++ ) {
			const view = new TableSizeChooser();

			view.on( 'over', () => {
				const row = parseInt( i / 10 );
				const column = i % 10;

				this.set( 'rows', row + 1 );
				this.set( 'columns', column + 1 );
			} );

			this.items.add( view );
		}

		this.on( 'change:columns', () => {
			this.updateItems();
		} );

		this.on( 'change:rows', () => {
			this.updateItems();
		} );
	}

	updateItems() {
		const row = this.rows - 1;
		const column = this.columns - 1;

		this.items.map( ( item, index ) => {
			const itemRow = parseInt( index / 10 );
			const itemColumn = index % 10;

			if ( itemRow <= row && itemColumn <= column ) {
				item.set( 'isOn', true );
			} else {
				item.set( 'isOn', false );
			}
		} );
	}
}

/**
 * The table UI plugin.
 *
 * @extends module:core/plugin~Plugin
 */
export default class TableUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;

		editor.ui.componentFactory.add( 'insertTable', locale => {
			const command = editor.commands.get( 'insertTable' );
			const dropdownView = createDropdown( locale );

			dropdownView.bind( 'isEnabled' ).to( command );

			dropdownView.buttonView.set( {
				icon: tableIcon,
				label: 'Insert table',
				tooltip: true
			} );

			const tableSizeView = new TableSizeView( locale );

			tableSizeView.delegate( 'execute' ).to( dropdownView );

			dropdownView.buttonView.on( 'open', () => {
				// Reset the chooser before showing it to the user.
				tableSizeView.rows = 0;
				tableSizeView.columns = 0;
			} );

			dropdownView.on( 'execute', () => {
				command.execute( { rows: tableSizeView.rows, columns: tableSizeView.columns } );

				tableSizeView.width = 0;
				tableSizeView.height = 0;

				editor.editing.view.focus();
			} );

			dropdownView.panelView.children.add( tableSizeView );

			return dropdownView;
		} );

		editor.ui.componentFactory.add( 'tableColumn', locale => {
			const options = [
				{ commandName: 'setColumnHeader', label: 'Header column', bindIsActive: true },
				{ commandName: 'insertColumnBefore', label: 'Insert column before' },
				{ commandName: 'insertColumnAfter', label: 'Insert column after' },
				{ commandName: 'removeColumn', label: 'Delete column' }
			];

			return this._prepareDropdown( 'Column', tableColumnIcon, options, locale );
		} );

		editor.ui.componentFactory.add( 'tableRow', locale => {
			const options = [
				{ commandName: 'setRowHeader', label: 'Header row', bindIsActive: true },
				{ commandName: 'insertRowBelow', label: 'Insert row below' },
				{ commandName: 'insertRowAbove', label: 'Insert row above' },
				{ commandName: 'removeRow', label: 'Delete row' }
			];

			return this._prepareDropdown( 'Row', tableRowIcon, options, locale );
		} );

		editor.ui.componentFactory.add( 'mergeCell', locale => {
			const options = [
				{ commandName: 'mergeCellUp', label: 'Merge cell up' },
				{ commandName: 'mergeCellRight', label: 'Merge cell right' },
				{ commandName: 'mergeCellDown', label: 'Merge cell down' },
				{ commandName: 'mergeCellLeft', label: 'Merge cell left' }
			];

			return this._prepareDropdown( 'Merge cell', tableMergeCellIcon, options, locale );
		} );

		editor.ui.componentFactory.add( 'splitCell', locale => {
			const options = [
				{ commandName: 'splitCellVertically', label: 'Split cell vertically' },
				{ commandName: 'splitCellHorizontally', label: 'Split cell horizontally' }
			];

			return this._prepareDropdown( 'Split cell', tableSplitCellIcon, options, locale );
		} );
	}

	/**
	 * Common method that prepares dropdown.
	 *
	 * @private
	 * @param {String} buttonName
	 * @param {String} icon
	 * @param {Array.<Object>} options
	 * @param locale
	 * @returns {module:ui/dropdown/dropdownview~DropdownView}
	 */
	_prepareDropdown( buttonName, icon, options, locale ) {
		const editor = this.editor;

		const dropdownView = createDropdown( locale );
		const commands = [];

		const dropdownItems = new Collection();

		for ( const option of options ) {
			addListOption( option, editor, commands, dropdownItems );
		}

		addListToDropdown( dropdownView, dropdownItems );

		dropdownView.buttonView.set( {
			label: buttonName,
			icon,
			tooltip: true
		} );

		dropdownView.bind( 'isEnabled' ).toMany( commands, 'isEnabled', ( ...areEnabled ) => {
			return areEnabled.some( isEnabled => isEnabled );
		} );

		this.listenTo( dropdownView, 'execute', evt => {
			editor.execute( evt.source.commandName );
			editor.editing.view.focus();
		} );

		return dropdownView;
	}
}

// Adds an option to a list view.
//
// @param {Object} commandName
// @param {String} label
// @param {module:core/editor/editor~Editor} editor
// @param {Array.<module:core/command~Command>} commands
// @param {module:utils/collection~Collection} dropdownItems
function addListOption( option, editor, commands, dropdownItems ) {
	const { commandName, label, bindIsActive } = option;
	const command = editor.commands.get( commandName );

	commands.push( command );

	const itemModel = new Model( {
		commandName,
		label
	} );

	itemModel.bind( 'isEnabled' ).to( command );

	if ( bindIsActive ) {
		itemModel.bind( 'isActive' ).to( command, 'value' );
	}

	dropdownItems.add( itemModel );
}
