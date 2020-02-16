/**
 * @module table/commands/resizecolumncommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import { findAncestor } from './utils';

/**
 * The split cell command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as `'resizeColumn'`
 * for an editor command.
 *
 * You can resize any column with this command, for example:
 *
 *		editor.execute( 'resizeColumn' );
 *
 * @extends module:core/command~Command
 */
export default class ResizeColumnCommand extends Command {
	/**
	 * Creates a new `ResizeColumnCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor The editor on which this command will be used.
	 * @param {Object} options
	 * @param {String} options.direction Indicates whether the command should split cells `'horizontally'` or `'vertically'`.
	 */
	constructor( editor, options = {} ) {
		super( editor );

		/**
		 * The direction that indicates which cell will be split.
		 *
		 * @readonly
		 * @member {String} #direction
		 */
		this.direction = options.direction || 'horizontally';
	}

	/**
	 * @inheritDoc
	 */
	refresh() {
		const model = this.editor.model;
		const doc = model.document;

		const tableCell = findAncestor( 'tableCell', doc.selection.getFirstPosition() );

		this.isEnabled = !!tableCell;
	}

	/**
	 * @inheritDoc
	 */
	execute( resizeAmount ) {
		const model = this.editor.model;
		const document = model.document;
		const selection = document.selection;

		const firstPosition = selection.getFirstPosition();
		const tableCell = findAncestor( 'tableCell', firstPosition );
		const table = findAncestor( 'table', firstPosition );

		const tableUtils = this.editor.plugins.get( 'TableUtils' );

		const columns = tableCell.parent.getChildren();
		const columnIndex = [ ...columns ].indexOf( tableCell );

		let newColWidth;

		[ ...table.getChildren() ].forEach( ( row, i ) => {
			// Always grab the width from the top cell, so every cell in the column
			// stays in sync as you resize.
			if ( i === 0 ) {
				const colwidth = parseInt( tableCell.getAttribute( 'colwidth' ) || 32 );
				newColWidth = colwidth + resizeAmount;
			}

			const cell = row.getChild( columnIndex );
			tableUtils.resizeColumn( cell, newColWidth );
		} );
	}
}
