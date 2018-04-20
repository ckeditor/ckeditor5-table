/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/converters/downcast
 */

import ViewPosition from '@ckeditor/ckeditor5-engine/src/view/position';
import ViewRange from '@ckeditor/ckeditor5-engine/src/view/range';
import TableWalker from './../tablewalker';

/**
 * Model table element to view table element conversion helper.
 *
 * This conversion helper creates whole table element with child elements.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastInsertTable() {
	return dispatcher => dispatcher.on( 'insert:table', ( evt, data, conversionApi ) => {
		const table = data.item;

		if ( !conversionApi.consumable.consume( table, 'insert' ) ) {
			return;
		}

		// Consume attributes if present to not fire attribute change downcast
		conversionApi.consumable.consume( table, 'attribute:headingRows:table' );
		conversionApi.consumable.consume( table, 'attribute:headingColumns:table' );

		// The <thead> and <tbody> elements are created on the fly when needed & cached by `getOrCreateTableSection()` function.
		const tableSections = {};

		const tableElement = conversionApi.writer.createContainerElement( 'table' );

		const tableWalker = new TableWalker( table );

		for ( const tableWalkerValue of tableWalker ) {
			const { row, cell } = tableWalkerValue;

			const tableSection = getOrCreateTableSection( getSectionName( tableWalkerValue ), tableElement, conversionApi, tableSections );
			const tableRow = table.getChild( row );

			// Check if row was converted
			const trElement = getOrCreateTr( tableRow, row, tableSection, conversionApi );

			// Consume table cell - it will be always consumed as we convert whole table at once.
			conversionApi.consumable.consume( cell, 'insert' );

			createViewTableCellElement( tableWalkerValue, ViewPosition.createAt( trElement, 'end' ), conversionApi );
		}

		const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );

		conversionApi.mapper.bindElements( table, tableElement );
		conversionApi.writer.insert( viewPosition, tableElement );
	}, { priority: 'normal' } );
}

/**
 * Model row element to view <tr> element conversion helper.
 *
 * This conversion helper creates whole <tr> element with child elements.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastInsertRow() {
	return dispatcher => dispatcher.on( 'insert:tableRow', ( evt, data, conversionApi ) => {
		const tableRow = data.item;

		if ( !conversionApi.consumable.consume( tableRow, 'insert' ) ) {
			return;
		}

		const table = tableRow.parent;

		const tableElement = conversionApi.mapper.toViewElement( table );

		const row = table.getChildIndex( tableRow );

		const tableWalker = new TableWalker( table, { startRow: row, endRow: row } );

		for ( const tableWalkerValue of tableWalker ) {
			const tableSection = getOrCreateTableSection( getSectionName( tableWalkerValue ), tableElement, conversionApi );
			const trElement = getOrCreateTr( tableRow, row, tableSection, conversionApi );

			// Consume table cell - it will be always consumed as we convert whole row at once.
			conversionApi.consumable.consume( tableWalkerValue.cell, 'insert' );

			createViewTableCellElement( tableWalkerValue, ViewPosition.createAt( trElement, 'end' ), conversionApi );
		}
	}, { priority: 'normal' } );
}

/**
 * Model row element to view <tr> element conversion helper.
 *
 * This conversion helper creates whole <tr> element with child elements.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastInsertCell() {
	return dispatcher => dispatcher.on( 'insert:tableCell', ( evt, data, conversionApi ) => {
		const tableCell = data.item;

		if ( !conversionApi.consumable.consume( tableCell, 'insert' ) ) {
			return;
		}

		const tableRow = tableCell.parent;
		const table = tableRow.parent;

		const tableWalker = new TableWalker( table );

		// We need to iterate over a table in order to get proper row & column values from a walker
		for ( const tableWalkerValue of tableWalker ) {
			if ( tableWalkerValue.cell === tableCell ) {
				const trElement = conversionApi.mapper.toViewElement( tableRow );
				const insertPosition = ViewPosition.createAt( trElement, tableRow.getChildIndex( tableCell ) );

				createViewTableCellElement( tableWalkerValue, insertPosition, conversionApi );

				// No need to iterate further.
				return;
			}
		}
	}, { priority: 'normal' } );
}

/**
 * Conversion helper that acts on attribute change for headingColumns and headingRows attributes.
 *
 * Depending on changed attributes this converter will:
 * - rename <td> to <th> elements or vice versa
 * - create <thead> or <tbody> elements
 * - remove empty <thead> or <tbody>
 *
 * @returns {Function} Conversion helper.
 */
export function downcastAttributeChange( attribute ) {
	return dispatcher => dispatcher.on( `attribute:${ attribute }:table`, ( evt, data, conversionApi ) => {
		const table = data.item;

		if ( !conversionApi.consumable.consume( data.item, evt.name ) ) {
			return;
		}

		const tableElement = conversionApi.mapper.toViewElement( table );

		const cachedTableSections = {};

		const tableWalker = new TableWalker( table );

		for ( const tableWalkerValue of tableWalker ) {
			const { row, cell } = tableWalkerValue;
			const tableRow = table.getChild( row );

			const trElement = conversionApi.mapper.toViewElement( tableRow );

			const desiredParentName = getSectionName( tableWalkerValue );

			if ( desiredParentName !== trElement.parent.name ) {
				let targetPosition;

				if (
					( desiredParentName == 'tbody' && row === data.attributeNewValue && data.attributeNewValue < data.attributeOldValue ) ||
					row === 0
				) {
					const tableSection = getOrCreateTableSection( desiredParentName, tableElement, conversionApi, cachedTableSections );

					targetPosition = ViewPosition.createAt( tableSection, 'start' );
				} else {
					const previousTr = conversionApi.mapper.toViewElement( table.getChild( row - 1 ) );

					targetPosition = ViewPosition.createAfter( previousTr );
				}

				conversionApi.writer.move( ViewRange.createOn( trElement ), targetPosition );
			}

			// Check whether current columnIndex is overlapped by table cells from previous rows.
			const desiredCellElementName = getCellElementName( tableWalkerValue );

			const viewCell = conversionApi.mapper.toViewElement( cell );

			// If in single change we're converting attribute changes and inserting cell the table cell might not be inserted into view
			// because of child conversion is done after parent.
			if ( viewCell && viewCell.name !== desiredCellElementName ) {
				conversionApi.writer.rename( viewCell, desiredCellElementName );
			}
		}

		removeTableSectionIfEmpty( 'thead', tableElement, conversionApi );
		removeTableSectionIfEmpty( 'tbody', tableElement, conversionApi );
	}, { priority: 'normal' } );
}

/**
 * Conversion helper that acts on removed row.
 *
 * @returns {Function} Conversion helper.
 */
export function downcastRemoveRow() {
	return dispatcher => dispatcher.on( 'remove:tableRow', ( evt, data, conversionApi ) => {
		// Prevent default remove converter.
		evt.stop();

		let viewStart = conversionApi.mapper.toViewPosition( data.position );

		const modelEnd = data.position.getShiftedBy( data.length );
		let viewEnd = conversionApi.mapper.toViewPosition( modelEnd, { isPhantom: true } );

		// Make sure that start and end positions are inside the same parent as default remove converter doesn't work well with
		// wrapped elements: https://github.com/ckeditor/ckeditor5-engine/issues/1414
		if ( viewStart.parent !== viewEnd.parent ) {
			if ( viewStart.parent.name == 'table' ) {
				viewStart = ViewPosition.createAt( viewEnd.parent );
			}

			if ( viewEnd.parent.name == 'table' ) {
				viewEnd = ViewPosition.createAt( viewStart.parent, 'end' );
			}
		}

		const viewRange = new ViewRange( viewStart, viewEnd );

		const removed = conversionApi.writer.remove( viewRange.getTrimmed() );

		for ( const child of ViewRange.createIn( removed ).getItems() ) {
			conversionApi.mapper.unbindViewElement( child );
		}
	}, { priority: 'higher' } );
}

// Creates a table cell element in a view.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @param {module:engine/view/position~Position} insertPosition
// @param conversionApi
function createViewTableCellElement( tableWalkerValue, insertPosition, conversionApi ) {
	const tableCell = tableWalkerValue.cell;

	const cellElementName = getCellElementName( tableWalkerValue );

	const cellElement = conversionApi.writer.createContainerElement( cellElementName );

	conversionApi.mapper.bindElements( tableCell, cellElement );
	conversionApi.writer.insert( insertPosition, cellElement );
}

// Creates or returns an existing tr element from a view.
function getOrCreateTr( tableRow, rowIndex, tableSection, conversionApi ) {
	let trElement = conversionApi.mapper.toViewElement( tableRow );

	if ( !trElement ) {
		// Will always consume since we're converting <tableRow> element from a parent <table>.
		conversionApi.consumable.consume( tableRow, 'insert' );

		trElement = conversionApi.writer.createContainerElement( 'tr' );
		conversionApi.mapper.bindElements( tableRow, trElement );

		const headingRows = tableRow.parent.getAttribute( 'headingRows' ) || 0;
		const offset = headingRows > 0 && rowIndex >= headingRows ? rowIndex - headingRows : rowIndex;

		const position = ViewPosition.createAt( tableSection, offset );
		conversionApi.writer.insert( position, trElement );
	}

	return trElement;
}

// Returns `th` for heading cells and `td` for other cells for current table walker value.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @returns {String}
function getCellElementName( tableWalkerValue ) {
	const { row, column, table: { headingRows, headingColumns } } = tableWalkerValue;

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

// Returns table section name for current table walker value.
//
// @param {module:table/tablewalker~TableWalkerValue} tableWalkerValue
// @returns {String}
function getSectionName( tableWalkerValue ) {
	const { row, table: { headingRows } } = tableWalkerValue;

	return row < headingRows ? 'thead' : 'tbody';
}

// Creates or returns an existing <tbody> or <thead> element witch caching.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param conversionApi
// @param {Object} cachedTableSection An object on which store cached elements.
// @return {module:engine/view/containerelement~ContainerElement}
function getOrCreateTableSection( sectionName, tableElement, conversionApi, cachedTableSections = {} ) {
	if ( cachedTableSections[ sectionName ] ) {
		return cachedTableSections[ sectionName ];
	}

	cachedTableSections[ sectionName ] = getExistingTableSectionElement( sectionName, tableElement );

	if ( !cachedTableSections[ sectionName ] ) {
		cachedTableSections[ sectionName ] = createTableSection( sectionName, tableElement, conversionApi );
	}

	return cachedTableSections[ sectionName ];
}

// Finds an existing <tbody> or <thead> element or returns undefined.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param conversionApi
function getExistingTableSectionElement( sectionName, tableElement ) {
	for ( const tableSection of tableElement.getChildren() ) {
		if ( tableSection.name == sectionName ) {
			return tableSection;
		}
	}
}

// Creates table section at the end of a table.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param conversionApi
// @return {module:engine/view/containerelement~ContainerElement}
function createTableSection( sectionName, tableElement, conversionApi ) {
	const tableChildElement = conversionApi.writer.createContainerElement( sectionName );

	conversionApi.writer.insert( ViewPosition.createAt( tableElement, sectionName == 'tbody' ? 'end' : 'start' ), tableChildElement );

	return tableChildElement;
}

// Removes an existing <tbody> or <thead> element if it is empty.
//
// @param {String} sectionName
// @param {module:engine/view/element~Element} tableElement
// @param conversionApi
function removeTableSectionIfEmpty( sectionName, tableElement, conversionApi ) {
	const tableSection = getExistingTableSectionElement( sectionName, tableElement );

	if ( tableSection && tableSection.childCount === 0 ) {
		conversionApi.writer.remove( ViewRange.createOn( tableSection ) );
	}
}
