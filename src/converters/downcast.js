/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/converters/downcast
 */

import TableWalker from './../tablewalker';
import { toWidgetEditable } from '@ckeditor/ckeditor5-widget/src/utils';
import { toTableWidget } from '../utils';

/**
 * Model table element to view table element conversion helper.
 *
 * This conversion helper creates the whole table element with child elements.
 *
 * @param {Object} options
 * @param {Boolean} options.asWidget If set to `true`, the downcast conversion will produce a widget.
 * @returns {Function} Conversion helper.
 */
export function downcastInsertTable( options = {} ) {
	return dispatcher => dispatcher.on( 'insert:table', ( evt, data, conversionApi ) => {
		const table = data.item;

		if ( !conversionApi.consumable.consume( table, 'insert' ) ) {
			return;
		}

		// Consume attributes if present to not fire attribute change downcast
		conversionApi.consumable.consume( table, 'attribute:headingRows:table' );
		conversionApi.consumable.consume( table, 'attribute:headingColumns:table' );

		const asWidget = options && options.asWidget;

		const figureElement = conversionApi.writer.createContainerElement( 'figure', { class: 'table' } );
		const tableElement = conversionApi.writer.createContainerElement( 'table' );
		conversionApi.writer.insert( conversionApi.writer.createPositionAt( figureElement, 0 ), tableElement );

		let tableWidget;

		if ( asWidget ) {
			tableWidget = toTableWidget( figureElement, conversionApi.writer );
		}

		const tableWalker = new TableWalker( table );

		const tableAttributes = {
			headingRows: table.getAttribute( 'headingRows' ) || 0,
			headingColumns: table.getAttribute( 'headingColumns' ) || 0
		};

		// Cache for created table rows.
		const viewRows = new Map();

		for ( const tableWalkerValue of tableWalker ) {
			const { row, cell } = tableWalkerValue;

			const tableSection = getOrCreateTableSection( getSectionName( row, tableAttributes ), tableElement, conversionApi );
			const tableRow = table.getChild( row );

			const trElement = viewRows.get( row ) || createTr( tableRow, row, tableSection, conversionApi );
			viewRows.set( row, trElement );

			// Consume table cell - it will be always consumed as we convert whole table at once.
			conversionApi.consumable.consume( cell, 'insert' );

			const insertPosition = conversionApi.writer.createPositionAt( trElement, 'end' );

			createViewTableCellElement( tableWalkerValue, tableAttributes, insertPosition, conversionApi, options );
		}

		const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );

		conversionApi.mapper.bindElements( table, asWidget ? tableWidget : figureElement );
		conversionApi.writer.insert( viewPosition, asWidget ? tableWidget : figureElement );
	} );
}

/**
 * Model row element to view `<tr>` element conversion helper.
 *
 * This conversion helper creates the whole `<tr>` element with child elements.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastInsertRow( options = {} ) {
	return dispatcher => dispatcher.on( 'insert:tableRow', ( evt, data, conversionApi ) => {
		const tableRow = data.item;

		if ( !conversionApi.consumable.consume( tableRow, 'insert' ) ) {
			return;
		}

		const table = tableRow.parent;

		const figureElement = conversionApi.mapper.toViewElement( table );
		const tableElement = getViewTable( figureElement );

		const row = table.getChildIndex( tableRow );

		const tableWalker = new TableWalker( table, { startRow: row, endRow: row } );

		const tableAttributes = {
			headingRows: table.getAttribute( 'headingRows' ) || 0,
			headingColumns: table.getAttribute( 'headingColumns' ) || 0
		};

		// Cache for created table rows.
		const viewRows = new Map();

		for ( const tableWalkerValue of tableWalker ) {
			const tableSection = getOrCreateTableSection( getSectionName( row, tableAttributes ), tableElement, conversionApi );

			const trElement = viewRows.get( row ) || createTr( tableRow, row, tableSection, conversionApi );
			viewRows.set( row, trElement );

			// Consume table cell - it will be always consumed as we convert whole row at once.
			conversionApi.consumable.consume( tableWalkerValue.cell, 'insert' );

			const insertPosition = conversionApi.writer.createPositionAt( trElement, 'end' );

			createViewTableCellElement( tableWalkerValue, tableAttributes, insertPosition, conversionApi, options );
		}
	} );
}

/**
 * Model table cell element to view `<td>` or `<th>` element conversion helper.
 *
 * This conversion helper will create proper `<th>` elements for table cells that are in the heading section (heading row or column)
 * and `<td>` otherwise.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastInsertCell( options = {} ) {
	return dispatcher => dispatcher.on( 'insert:tableCell', ( evt, data, conversionApi ) => {
		const tableCell = data.item;

		if ( !conversionApi.consumable.consume( tableCell, 'insert' ) ) {
			return;
		}

		const tableRow = tableCell.parent;
		const table = tableRow.parent;
		const rowIndex = table.getChildIndex( tableRow );

		const tableWalker = new TableWalker( table, { startRow: rowIndex, endRow: rowIndex } );

		const tableAttributes = {
			headingRows: table.getAttribute( 'headingRows' ) || 0,
			headingColumns: table.getAttribute( 'headingColumns' ) || 0
		};

		// We need to iterate over a table in order to get proper row & column values from a walker
		for ( const tableWalkerValue of tableWalker ) {
			if ( tableWalkerValue.cell === tableCell ) {
				const trElement = conversionApi.mapper.toViewElement( tableRow );
				const insertPosition = conversionApi.writer.createPositionAt( trElement, tableRow.getChildIndex( tableCell ) );

				createViewTableCellElement( tableWalkerValue, tableAttributes, insertPosition, conversionApi, options );

				// No need to iterate further.
				return;
			}
		}
	} );
}

/**
 * Conversion helper that acts on heading rows table attribute change.
 *
 * This converter will:
 *
 * * Rename `<td>` to `<th>` elements or vice versa depending on headings.
 * * Create `<thead>` or `<tbody>` elements if needed.
 * * Remove empty `<thead>` or `<tbody>` if needed.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastTableHeadingRowsChange( options = {} ) {
	const asWidget = !!options.asWidget;

	return dispatcher => dispatcher.on( 'attribute:headingRows:table', ( evt, data, conversionApi ) => {
		const table = data.item;

		if ( !conversionApi.consumable.consume( data.item, evt.name ) ) {
			return;
		}

		const figureElement = conversionApi.mapper.toViewElement( table );
		const viewTable = getViewTable( figureElement );

		const oldRows = data.attributeOldValue;
		const newRows = data.attributeNewValue;

		// The head section has grown so move rows from <tbody> to <thead>.
		if ( newRows > oldRows ) {
			// Filter out only those rows that are in wrong section.
			const rowsToMove = Array.from( table.getChildren() ).filter( ( { index } ) => isBetween( index, oldRows - 1, newRows ) );

			const viewTableHead = getOrCreateTableSection( 'thead', viewTable, conversionApi );
			moveViewRowsToTableSection( rowsToMove, viewTableHead, conversionApi, 'end' );

			// Rename all table cells from moved rows to 'th' as they lands in <thead>.
			for ( const tableRow of rowsToMove ) {
				for ( const tableCell of tableRow.getChildren() ) {
					renameViewTableCell( tableCell, 'th', conversionApi, asWidget );
				}
			}

			// Cleanup: this will remove any empty section from the view which may happen when moving all rows from a table section.
			removeTableSectionIfEmpty( 'tbody', viewTable, conversionApi );
		}
		// The head section has shrunk so move rows from <thead> to <tbody>.
		else {
			// Filter out only those rows that are in wrong section.
			const rowsToMove = Array.from( table.getChildren() )
				.filter( ( { index } ) => isBetween( index, newRows - 1, oldRows ) )
				.reverse(); // The rows will be moved from <thead> to <tbody> in reverse order at the beginning of a <tbody>.

			const viewTableBody = getOrCreateTableSection( 'tbody', viewTable, conversionApi );
			moveViewRowsToTableSection( rowsToMove, viewTableBody, conversionApi, 0 );

			// Check if cells moved from <thead> to <tbody> requires renaming to <td> as this depends on current heading columns attribute.
			const tableWalker = new TableWalker( table, { startRow: newRows ? newRows - 1 : newRows, endRow: oldRows - 1 } );

			const tableAttributes = {
				headingRows: table.getAttribute( 'headingRows' ) || 0,
				headingColumns: table.getAttribute( 'headingColumns' ) || 0
			};

			for ( const tableWalkerValue of tableWalker ) {
				renameViewTableCellIfRequired( tableWalkerValue, tableAttributes, conversionApi, asWidget );
			}

			// Cleanup: this will remove any empty section from the view which may happen when moving all rows from a table section.
			removeTableSectionIfEmpty( 'thead', viewTable, conversionApi );
		}

		function isBetween( index, lower, upper ) {
			return index > lower && index < upper;
		}
	} );
}

/**
 * Conversion helper that acts on heading columns table attribute change.
 *
 * Depending on changed attributes this converter will rename `<td` to `<th>` elements or vice versa depending of the cell column index.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastTableHeadingColumnsChange( options = {} ) {
	const asWidget = !!options.asWidget;

	return dispatcher => dispatcher.on( 'attribute:headingColumns:table', ( evt, data, conversionApi ) => {
		const table = data.item;

		if ( !conversionApi.consumable.consume( data.item, evt.name ) ) {
			return;
		}

		const tableAttributes = {
			headingRows: table.getAttribute( 'headingRows' ) || 0,
			headingColumns: table.getAttribute( 'headingColumns' ) || 0
		};

		const oldColumns = data.attributeOldValue;
		const newColumns = data.attributeNewValue;

		const lastColumnToCheck = ( oldColumns > newColumns ? oldColumns : newColumns ) - 1;

		for ( const tableWalkerValue of new TableWalker( table ) ) {
			// Skip cells that were not in heading section before and after the change.
			if ( tableWalkerValue.column > lastColumnToCheck ) {
				continue;
			}

			renameViewTableCellIfRequired( tableWalkerValue, tableAttributes, conversionApi, asWidget );
		}
	} );
}

/**
 * Conversion helper that acts on a removed row.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastRemoveRow() {
	return dispatcher => dispatcher.on( 'remove:tableRow', ( evt, data, conversionApi ) => {
		// Prevent default remove converter.
		evt.stop();
		const viewWriter = conversionApi.writer;
		const mapper = conversionApi.mapper;

		const viewStart = mapper.toViewPosition( data.position ).getLastMatchingPosition( value => !value.item.is( 'tr' ) );
		const viewItem = viewStart.nodeAfter;
		const tableSection = viewItem.parent;

		// Remove associated <tr> from the view.
		const removeRange = viewWriter.createRangeOn( viewItem );
		const removed = viewWriter.remove( removeRange );

		for ( const child of viewWriter.createRangeIn( removed ).getItems() ) {
			mapper.unbindViewElement( child );
		}

		// Check if table section has any children left - if not remove it from the view.
		if ( !tableSection.childCount ) {
			// No need to unbind anything as table section is not represented in the model.
			viewWriter.remove( viewWriter.createRangeOn( tableSection ) );
		}
	}, { priority: 'higher' } );
}

// Renames an existing table cell in the view to a given element name.
//
// **Note** This method will not do anything if a view table cell was not yet converted.
//
// @param {module:engine/model/element~Element} tableCell
// @param {String} desiredCellElementName
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @param {Boolean} asWidget
function renameViewTableCell( tableCell, desiredCellElementName, conversionApi, asWidget ) {
	const viewWriter = conversionApi.writer;
	const viewCell = conversionApi.mapper.toViewElement( tableCell );

	// View cell might be not yet converted - skip it as it will be properly created by cell converter later on.
	if ( !viewCell ) {
		return;
	}

	let renamedCell;

	if ( asWidget ) {
		const editable = viewWriter.createEditableElement( desiredCellElementName, viewCell.getAttributes() );
		renamedCell = toWidgetEditable( editable, viewWriter );

		viewWriter.insert( viewWriter.createPositionAfter( viewCell ), renamedCell );
		viewWriter.move( viewWriter.createRangeIn( viewCell ), viewWriter.createPositionAt( renamedCell, 0 ) );
		viewWriter.remove( viewWriter.createRangeOn( viewCell ) );
	} else {
		renamedCell = viewWriter.rename( desiredCellElementName, viewCell );
	}

	conversionApi.mapper.unbindViewElement( viewCell );
	conversionApi.mapper.bindElements( tableCell, renamedCell );
}

// Renames a table cell element in the view according to its location in the table.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @param {{headingColumns, headingRows}} tableAttributes
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @param {Boolean} asWidget
function renameViewTableCellIfRequired( tableWalkerValue, tableAttributes, conversionApi, asWidget ) {
	const { cell } = tableWalkerValue;

	// Check whether current columnIndex is overlapped by table cells from previous rows.
	const desiredCellElementName = getCellElementName( tableWalkerValue, tableAttributes );

	const viewCell = conversionApi.mapper.toViewElement( cell );

	// If in single change we're converting attribute changes and inserting cell the table cell might not be inserted into view
	// because of child conversion is done after parent.
	if ( viewCell && viewCell.name !== desiredCellElementName ) {
		renameViewTableCell( cell, desiredCellElementName, conversionApi, asWidget );
	}
}

// Creates a table cell element in the view.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @param {module:engine/view/position~Position} insertPosition
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
function createViewTableCellElement( tableWalkerValue, tableAttributes, insertPosition, conversionApi, options ) {
	const asWidget = options && options.asWidget;
	const cellElementName = getCellElementName( tableWalkerValue, tableAttributes );

	const cellElement = asWidget ?
		toWidgetEditable( conversionApi.writer.createEditableElement( cellElementName ), conversionApi.writer ) :
		conversionApi.writer.createContainerElement( cellElementName );

	const tableCell = tableWalkerValue.cell;

	const firstChild = tableCell.getChild( 0 );
	const isSingleParagraph = tableCell.childCount === 1 && firstChild.name === 'paragraph';

	conversionApi.writer.insert( insertPosition, cellElement );

	// Insert cell resizer UI.
	// TODO (maybe): Only add the resizer to cells in the first row, then use CSS to render
	// them the full table height.
	const resizerElement = conversionApi.writer.createContainerElement( 'div', { class: 'ck-table-resizer' } );
	const resizerInsertPosition = conversionApi.writer.createPositionAt( cellElement, 'end' );
	conversionApi.writer.insert( resizerInsertPosition, resizerElement );

	if ( isSingleParagraph && !hasAnyAttribute( firstChild ) ) {
		const innerParagraph = tableCell.getChild( 0 );
		const paragraphInsertPosition = conversionApi.writer.createPositionAt( cellElement, 'end' );

		conversionApi.consumable.consume( innerParagraph, 'insert' );

		if ( options.asWidget ) {
			// Use display:inline-block to force Chrome/Safari to limit text mutations to this element.
			// See #6062.
			const fakeParagraph = conversionApi.writer.createContainerElement( 'span', { style: 'display:inline-block' } );

			conversionApi.mapper.bindElements( innerParagraph, fakeParagraph );
			conversionApi.writer.insert( paragraphInsertPosition, fakeParagraph );

			conversionApi.mapper.bindElements( tableCell, cellElement );
		} else {
			conversionApi.mapper.bindElements( tableCell, cellElement );
			conversionApi.mapper.bindElements( innerParagraph, cellElement );
		}
	} else {
		conversionApi.mapper.bindElements( tableCell, cellElement );
	}
}

// Creates `<tr>` view element.
//
// @param {module:engine/view/element~Element} tableRow
// @param {Number} rowIndex
// @param {module:engine/view/element~Element} tableSection
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @returns {module:engine/view/element~Element}
function createTr( tableRow, rowIndex, tableSection, conversionApi ) {
	// Will always consume since we're converting <tableRow> element from a parent <table>.
	conversionApi.consumable.consume( tableRow, 'insert' );

	const trElement = conversionApi.writer.createContainerElement( 'tr' );
	conversionApi.mapper.bindElements( tableRow, trElement );

	const headingRows = tableRow.parent.getAttribute( 'headingRows' ) || 0;
	const offset = headingRows > 0 && rowIndex >= headingRows ? rowIndex - headingRows : rowIndex;

	const position = conversionApi.writer.createPositionAt( tableSection, offset );
	conversionApi.writer.insert( position, trElement );

	return trElement;
}

// Returns `th` for heading cells and `td` for other cells for the current table walker value.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @param {{headingColumns, headingRows}} tableAttributes
// @returns {String}
function getCellElementName( tableWalkerValue, tableAttributes ) {
	const { row, column } = tableWalkerValue;
	const { headingColumns, headingRows } = tableAttributes;

	// Column heading are all tableCells in the first `columnHeading` rows.
	const isColumnHeading = headingRows && headingRows > row;

	// So a whole row gets <th> element.
	if ( isColumnHeading ) {
		return 'th';
	}

	// Row heading are tableCells which columnIndex is lower then headingColumns.
	const isRowHeading = headingColumns && headingColumns > column;

	return isRowHeading ? 'th' : 'td';
}

// Returns the table section name for the current table walker value.
//
// @param {Number} row
// @param {{headingColumns, headingRows}} tableAttributes
// @returns {String}
function getSectionName( row, tableAttributes ) {
	return row < tableAttributes.headingRows ? 'thead' : 'tbody';
}

// Creates or returns an existing `<tbody>` or `<thead>` element witch caching.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} viewTable
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @param {Object} cachedTableSection An object that stores cached elements.
// @returns {module:engine/view/containerelement~ContainerElement}
function getOrCreateTableSection( sectionName, viewTable, conversionApi ) {
	const viewTableSection = getExistingTableSectionElement( sectionName, viewTable );

	return viewTableSection ? viewTableSection : createTableSection( sectionName, viewTable, conversionApi );
}

// Finds an existing `<tbody>` or `<thead>` element or returns undefined.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
function getExistingTableSectionElement( sectionName, tableElement ) {
	for ( const tableSection of tableElement.getChildren() ) {
		if ( tableSection.name == sectionName ) {
			return tableSection;
		}
	}
}

// Creates a table section at the end of the table.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @returns {module:engine/view/containerelement~ContainerElement}
function createTableSection( sectionName, tableElement, conversionApi ) {
	const tableChildElement = conversionApi.writer.createContainerElement( sectionName );

	const insertPosition = conversionApi.writer.createPositionAt( tableElement, sectionName == 'tbody' ? 'end' : 0 );

	conversionApi.writer.insert( insertPosition, tableChildElement );

	return tableChildElement;
}

// Removes an existing `<tbody>` or `<thead>` element if it is empty.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
function removeTableSectionIfEmpty( sectionName, tableElement, conversionApi ) {
	const tableSection = getExistingTableSectionElement( sectionName, tableElement );

	if ( tableSection && tableSection.childCount === 0 ) {
		conversionApi.writer.remove( conversionApi.writer.createRangeOn( tableSection ) );
	}
}

// Moves view table rows associated with passed model rows to the provided table section element.
//
// **Note** This method will skip not converted table rows.
//
// @param {Array.<module:engine/model/element~Element>} rowsToMove
// @param {module:engine/view/element~Element} viewTableSection
// @param {module:engine/conversion/downcastdispatcher~DowncastConversionApi} conversionApi
// @param {Number|'end'|'before'|'after'} offset Offset or one of the flags.
function moveViewRowsToTableSection( rowsToMove, viewTableSection, conversionApi, offset ) {
	for ( const tableRow of rowsToMove ) {
		const viewTableRow = conversionApi.mapper.toViewElement( tableRow );

		// View table row might be not yet converted - skip it as it will be properly created by cell converter later on.
		if ( viewTableRow ) {
			conversionApi.writer.move(
				conversionApi.writer.createRangeOn( viewTableRow ),
				conversionApi.writer.createPositionAt( viewTableSection, offset )
			);
		}
	}
}

// Properly finds '<table>' element inside `<figure>` widget.
//
// @param {module:engine/view/element~Element} viewFigure
function getViewTable( viewFigure ) {
	for ( const child of viewFigure.getChildren() ) {
		if ( child.name === 'table' ) {
			return child;
		}
	}
}

// Checks if element has any attribute set.
//
// @param {module:engine/model/element~Element element
// @returns {Boolean}
function hasAnyAttribute( element ) {
	return !![ ...element.getAttributeKeys() ].length;
}
