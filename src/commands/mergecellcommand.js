/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/commands/mergecellcommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import TableWalker from '../tablewalker';
import { findAncestor, updateNumericAttribute } from './utils';

/**
 * The merge cell command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as `'mergeTableCellRight'`, `'mergeTableCellLeft'`,
 * `'mergeTableCellUp'` and `'mergeTableCellDown'` editor commands.
 *
 * To merge a table cell at the current selection with another cell, execute the command corresponding with the preferred direction.
 *
 * For example, to merge with a cell to the right:
 *
 *		editor.execute( 'mergeTableCellRight' );
 *
 * **Note**: If a table cell has a different [`rowspan`](https://www.w3.org/TR/html50/tabular-data.html#attr-tdth-rowspan)
 * (for `'mergeTableCellRight'` and `'mergeTableCellLeft'`) or [`colspan`](https://www.w3.org/TR/html50/tabular-data.html#attr-tdth-colspan)
 * (for `'mergeTableCellUp'` and `'mergeTableCellDown'`), the command will be disabled.
 *
 * @extends module:core/command~Command
 */
export default class MergeCellCommand extends Command {
	/**
	 * Creates a new `MergeCellCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor The editor on which this command will be used.
	 * @param {Object} options
	 * @param {String} options.direction Indicates which cell to merge with the currently selected one.
	 * Possible values are: `'left'`, `'right'`, `'up'` and `'down'`.
	 */
	constructor( editor, options ) {
		super( editor );

		/**
		 * The direction that indicates which cell will be merged with the currently selected one.
		 *
		 * @readonly
		 * @member {String} #direction
		 */
		this.direction = options.direction;

		/**
		 * Whether the merge is horizontal (left/right) or vertical (up/down).
		 *
		 * @readonly
		 * @member {Boolean} #isHorizontal
		 */
		this.isHorizontal = this.direction == 'right' || this.direction == 'left';
	}

	/**
	 * @inheritDoc
	 */
	refresh() {
		const cellToMerge = this._getMergeableCell();

		this.isEnabled = !!cellToMerge;
		// In order to check if currently selected cell can be merged with one defined by #direction some computation are done beforehand.
		// As such we can cache it as a command's value.
		this.value = cellToMerge;
	}

	/**
	 * Executes the command.
	 *
	 * Depending on the command's {@link #direction} value, it will merge the cell that is to the `'left'`, `'right'`, `'up'` or `'down'`.
	 *
	 * @fires execute
	 */
	execute() {
		const model = this.editor.model;
		const doc = model.document;
		const tableCell = findAncestor( 'tableCell', doc.selection.getFirstPosition() );
		const cellToMerge = this.value;
		const direction = this._localizedDirection;

		model.change( writer => {
			const isMergeNext = direction == 'right' || direction == 'down';

			// The merge mechanism is always the same so sort cells to be merged.
			const cellToExpand = isMergeNext ? tableCell : cellToMerge;
			const cellToRemove = isMergeNext ? cellToMerge : tableCell;

			// Cache the parent of cell to remove for later check.
			const removedTableCellRow = cellToRemove.parent;

			mergeTableCells( cellToRemove, cellToExpand, writer );

			const spanAttribute = this.isHorizontal ? 'colspan' : 'rowspan';
			const cellSpan = parseInt( tableCell.getAttribute( spanAttribute ) || 1 );
			const cellToMergeSpan = parseInt( cellToMerge.getAttribute( spanAttribute ) || 1 );

			// Update table cell span attribute and merge set selection on merged contents.
			writer.setAttribute( spanAttribute, cellSpan + cellToMergeSpan, cellToExpand );
			writer.setSelection( writer.createRangeIn( cellToExpand ) );

			// Remove empty row after merging.
			if ( !removedTableCellRow.childCount ) {
				removeEmptyRow( removedTableCellRow, writer );
			}
		} );
	}

	/**
	 * Returns a cell that can be merged with the current cell depending on the command's direction.
	 *
	 * @returns {module:engine/model/element~Element|undefined}
	 * @private
	 */
	_getMergeableCell() {
		const model = this.editor.model;
		const doc = model.document;
		const tableCell = findAncestor( 'tableCell', doc.selection.getFirstPosition() );

		if ( !tableCell ) {
			return;
		}

		const tableUtils = this.editor.plugins.get( 'TableUtils' );
		const direction = this._localizedDirection;

		// First get the cell on proper direction.
		const cellToMerge = this.isHorizontal ?
			getHorizontalCell( tableCell, direction, tableUtils ) :
			getVerticalCell( tableCell, direction );

		if ( !cellToMerge ) {
			return;
		}

		// If found check if the span perpendicular to merge direction is equal on both cells.
		const spanAttribute = this.isHorizontal ? 'rowspan' : 'colspan';
		const span = parseInt( tableCell.getAttribute( spanAttribute ) || 1 );

		const cellToMergeSpan = parseInt( cellToMerge.getAttribute( spanAttribute ) || 1 );

		if ( cellToMergeSpan === span ) {
			return cellToMerge;
		}
	}

	/**
	 * Returns {@link #direction} of the command considering editor {@link module:core/editor/editor~Editor#locale}.
	 *
	 * In RTL content, the table is (visually) mirrored horizontally. Cells logically "before" are displayed on the
	 * right–side and vice–versa. So for the UI/UX to make sense, the command must work the other way around.
	 *
	 * @protected
	 */
	get _localizedDirection() {
		let direction = this.direction;

		if ( this.editor.locale.contentLanguageDirection == 'rtl' ) {
			if ( direction === 'right' ) {
				direction = 'left';
			} else if ( direction === 'left' ) {
				direction = 'right';
			}
		}

		return direction;
	}
}

// Returns the cell that can be merged horizontally.
//
// @param {module:engine/model/element~Element} tableCell
// @param {String} direction
// @returns {module:engine/model/node~Node|null}
function getHorizontalCell( tableCell, direction, tableUtils ) {
	const horizontalCell = direction == 'right' ? tableCell.nextSibling : tableCell.previousSibling;

	if ( !horizontalCell ) {
		return;
	}

	// Sort cells:
	const cellOnLeft = direction == 'right' ? tableCell : horizontalCell;
	const cellOnRight = direction == 'right' ? horizontalCell : tableCell;

	// Get their column indexes:
	const { column: leftCellColumn } = tableUtils.getCellLocation( cellOnLeft );
	const { column: rightCellColumn } = tableUtils.getCellLocation( cellOnRight );

	const leftCellSpan = parseInt( cellOnLeft.getAttribute( 'colspan' ) || 1 );

	// The cell on the right must have index that is distant to the cell on the left by the left cell's width (colspan).
	const cellsAreTouching = leftCellColumn + leftCellSpan === rightCellColumn;

	// If the right cell's column index is different it means that there are rowspanned cells between them.
	return cellsAreTouching ? horizontalCell : undefined;
}

// Returns the cell that can be merged vertically.
//
// @param {module:engine/model/element~Element} tableCell
// @param {String} direction
// @returns {module:engine/model/node~Node|null}
function getVerticalCell( tableCell, direction ) {
	const tableRow = tableCell.parent;
	const table = tableRow.parent;

	const rowIndex = table.getChildIndex( tableRow );

	// Don't search for mergeable cell if direction points out of the table.
	if ( ( direction == 'down' && rowIndex === table.childCount - 1 ) || ( direction == 'up' && rowIndex === 0 ) ) {
		return;
	}

	const rowspan = parseInt( tableCell.getAttribute( 'rowspan' ) || 1 );
	const headingRows = table.getAttribute( 'headingRows' ) || 0;

	const isMergeWithBodyCell = direction == 'down' && ( rowIndex + rowspan ) === headingRows;
	const isMergeWithHeadCell = direction == 'up' && rowIndex === headingRows;

	// Don't search for mergeable cell if direction points out of the current table section.
	if ( headingRows && ( isMergeWithBodyCell || isMergeWithHeadCell ) ) {
		return;
	}

	const currentCellRowSpan = parseInt( tableCell.getAttribute( 'rowspan' ) || 1 );
	const rowOfCellToMerge = direction == 'down' ? rowIndex + currentCellRowSpan : rowIndex;

	const tableMap = [ ...new TableWalker( table, { endRow: rowOfCellToMerge } ) ];

	const currentCellData = tableMap.find( value => value.cell === tableCell );
	const mergeColumn = currentCellData.column;

	const cellToMergeData = tableMap.find( ( { row, rowspan, column } ) => {
		if ( column !== mergeColumn ) {
			return false;
		}

		if ( direction == 'down' ) {
			// If merging a cell below the mergeRow is already calculated.
			return row === rowOfCellToMerge;
		} else {
			// If merging a cell above calculate if it spans to mergeRow.
			return rowOfCellToMerge === row + rowspan;
		}
	} );

	return cellToMergeData && cellToMergeData.cell;
}

// Properly removes empty row from a table. Will update `rowspan` attribute of cells that overlaps removed row.
//
// @param {module:engine/model/element~Element} removedTableCellRow
// @param {module:engine/model/writer~Writer} writer
function removeEmptyRow( removedTableCellRow, writer ) {
	const table = removedTableCellRow.parent;

	const removedRowIndex = table.getChildIndex( removedTableCellRow );

	for ( const { cell, row, rowspan } of new TableWalker( table, { endRow: removedRowIndex } ) ) {
		const overlapsRemovedRow = row + rowspan - 1 >= removedRowIndex;

		if ( overlapsRemovedRow ) {
			updateNumericAttribute( 'rowspan', rowspan - 1, cell, writer );
		}
	}

	writer.remove( removedTableCellRow );
}

// Merges two table cells - will ensure that after merging cells with empty paragraph the result table cell will only have one paragraph.
// If one of the merged table cell is empty the merged table cell will have contents of the non-empty table cell.
// If both are empty the merged table cell will have only one empty paragraph.
//
// @param {module:engine/model/element~Element} cellToRemove
// @param {module:engine/model/element~Element} cellToExpand
// @param {module:engine/model/writer~Writer} writer
function mergeTableCells( cellToRemove, cellToExpand, writer ) {
	if ( !isEmpty( cellToRemove ) ) {
		if ( isEmpty( cellToExpand ) ) {
			writer.remove( writer.createRangeIn( cellToExpand ) );
		}

		writer.move( writer.createRangeIn( cellToRemove ), writer.createPositionAt( cellToExpand, 'end' ) );
	}

	// Remove merged table cell.
	writer.remove( cellToRemove );
}

// Checks if passed table cell contains empty paragraph.
//
// @param {module:engine/model/element~Element} tableCell
// @returns {Boolean}
function isEmpty( tableCell ) {
	return tableCell.childCount == 1 && tableCell.getChild( 0 ).is( 'paragraph' ) && tableCell.getChild( 0 ).isEmpty;
}
