/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/commands/insertcolumncommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import { findAncestor } from './utils';

/**
 * The insert column command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as `'insertTableColumnLeft'` and
 * `'insertTableColumnRight'` editor commands.
 *
 * To insert a column to the left of the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableColumnLeft' );
 *
 * To insert a column to the right of the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableColumnRight' );
 *
 * @extends module:core/command~Command
 */
export default class InsertColumnCommand extends Command {
	/**
	 * Creates a new `InsertColumnCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor An editor on which this command will be used.
	 * @param {Object} options
	 * @param {String} [options.order="right"] The order of insertion relative to the column in which the caret is located.
	 * Possible values: `"left"` and `"right"`.
	 */
	constructor( editor, options = {} ) {
		super( editor );

		/**
		 * The order of insertion relative to the column in which the caret is located.
		 *
		 * @readonly
		 * @member {String} module:table/commands/insertcolumncommand~InsertColumnCommand#order
		 */
		this.order = options.order || 'right';
	}

	/**
	 * @inheritDoc
	 */
	refresh() {
		const selection = this.editor.model.document.selection;

		const tableParent = findAncestor( 'table', selection.getFirstPosition() );

		this.isEnabled = !!tableParent;
	}

	/**
	 * Executes the command.
	 *
	 * Depending on the command's {@link #order} value, it inserts a column to the `'left'` or `'right'` of the column
	 * in which the selection is set.
	 *
	 * @fires execute
	 */
	execute() {
		const editor = this.editor;
		const selection = editor.model.document.selection;
		const tableUtils = editor.plugins.get( 'TableUtils' );
		const contentLanguageDirection = editor.locale.contentLanguageDirection;

		const firstPosition = selection.getFirstPosition();

		const tableCell = findAncestor( 'tableCell', firstPosition );
		const table = tableCell.parent.parent;

		let { column } = tableUtils.getCellLocation( tableCell );
		const isOrderRight = this.order === 'right';
		const isContentLtr = contentLanguageDirection === 'ltr';

		// In RTL content, the table is (visually) mirrored horizontally. Columns "before" are
		// displayed on the right–side and vice–versa. So for the UI/UX to make sense, commands must
		// work the other way around. It is confusing and it is easy to get it wrong.
		//
		//                              ┌──────────────────────────────┐
		//                              │            order             │
		//                              ├───────────────┰──────────────┤
		//                              │    'right'    │    'left'    │
		//          ┌───────────┰───────┼───────────────┼──────────────┤
		//          │   content │ 'ltr' │   column+1    │    column    │
		//          │  language │───────┼───────────────┼──────────────┤
		//          │ direction │ 'rtl' │    column     │   column+1   │
		//          └───────────┴───────┴───────────────┴──────────────┘
		//
		if ( ( isOrderRight && isContentLtr ) || ( !isOrderRight && !isContentLtr ) ) {
			++column;
		}

		tableUtils.insertColumns( table, { columns: 1, at: column } );
	}
}
