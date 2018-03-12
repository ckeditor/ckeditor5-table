/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/converters/upcasttable
 */

import ModelRange from '@ckeditor/ckeditor5-engine/src/model/range';
import ModelPosition from '@ckeditor/ckeditor5-engine/src/model/position';

/**
 * View table element to model table element conversion helper.
 *
 * This conversion helper convert table element as well as tableRows.
 *
 * @returns {Function} Conversion helper.
 */
export default function upcastTable() {
	return dispatcher => {
		dispatcher.on( 'element:table', ( evt, data, conversionApi ) => {
			const viewTable = data.viewItem;

			// When element was already consumed then skip it.
			if ( !conversionApi.consumable.test( viewTable, { name: true } ) ) {
				return;
			}

			const { rows, headingRows, headingColumns } = scanTable( viewTable );

			// Nullify 0 values so they are not stored in model.
			const attributes = {
				headingColumns: headingColumns || null,
				headingRows: headingRows || null
			};

			const table = conversionApi.writer.createElement( 'table', attributes );

			// Insert element on allowed position.
			const splitResult = conversionApi.splitToAllowedParent( table, data.modelCursor );
			conversionApi.writer.insert( table, splitResult.position );
			conversionApi.consumable.consume( viewTable, { name: true } );

			// Upcast table rows as we need to insert them to table in proper order (heading rows first).
			upcastTableRows( rows, table, conversionApi );

			// Set conversion result range.
			data.modelRange = new ModelRange(
				// Range should start before inserted element
				ModelPosition.createBefore( table ),
				// Should end after but we need to take into consideration that children could split our
				// element, so we need to move range after parent of the last converted child.
				// before: <allowed>[]</allowed>
				// after: <allowed>[<converted><child></child></converted><child></child><converted>]</converted></allowed>
				ModelPosition.createAfter( table )
			);

			// Now we need to check where the modelCursor should be.
			// If we had to split parent to insert our element then we want to continue conversion inside split parent.
			//
			// before: <allowed><notAllowed>[]</notAllowed></allowed>
			// after:  <allowed><notAllowed></notAllowed><converted></converted><notAllowed>[]</notAllowed></allowed>
			if ( splitResult.cursorParent ) {
				data.modelCursor = ModelPosition.createAt( splitResult.cursorParent );

				// Otherwise just continue after inserted element.
			} else {
				data.modelCursor = data.modelRange.end;
			}
		}, { priority: 'normal' } );
	};
}

// Scans table rows & extracts required metadata from table:
//
// headingRows    - number of rows that goes as table header.
// headingColumns - max number of row headings.
// rows           - sorted trs as they should go into the model - ie if <thead> is inserted after <tbody> in the view.
//
// @param {module:engine/view/element~Element} viewTable
// @returns {{headingRows, headingColumns, rows}}
function scanTable( viewTable ) {
	const tableMeta = {
		headingRows: 0,
		headingColumns: 0
	};

	const headRows = [];
	const bodyRows = [];

	let firstTheadElement;

	for ( const tableChild of Array.from( viewTable.getChildren() ) ) {
		// Only <thead>, <tbody> & <tfoot> from allowed table children can have <tr>s.
		// The else is for future purposes (mainly <caption>).
		if ( tableChild.name === 'tbody' || tableChild.name === 'thead' || tableChild.name === 'tfoot' ) {
			// Save the first <thead> in the table as table header - all other ones will be converted to table body rows.
			if ( tableChild.name === 'thead' && !firstTheadElement ) {
				firstTheadElement = tableChild;
			}

			for ( const tr of Array.from( tableChild.getChildren() ) ) {
				// This <tr> is a child of a first <thead> element.
				if ( tr.parent.name === 'thead' && tr.parent === firstTheadElement ) {
					tableMeta.headingRows++;
					headRows.push( tr );
				} else {
					bodyRows.push( tr );
					// For other rows check how many column headings this row has.

					const headingCols = scanRowForHeadingColumns( tr, tableMeta, firstTheadElement );

					if ( headingCols > tableMeta.headingColumns ) {
						tableMeta.headingColumns = headingCols;
					}
				}
			}
		}
	}

	tableMeta.rows = [ ...headRows, ...bodyRows ];

	return tableMeta;
}

// Converts table rows and extracts table metadata.
//
// @param {module:engine/view/element~Element} viewTable
// @param {module:engine/model/element~Element} modelTable
// @param {module:engine/conversion/upcastdispatcher~ViewConversionApi} conversionApi
// @returns {{headingRows, headingColumns}}
function upcastTableRows( viewRows, modelTable, conversionApi ) {
	for ( const viewRow of viewRows ) {
		const modelRow = conversionApi.writer.createElement( 'tableRow' );
		conversionApi.writer.insert( modelRow, ModelPosition.createAt( modelTable, 'end' ) );
		conversionApi.consumable.consume( viewRow, { name: true } );

		const childrenCursor = ModelPosition.createAt( modelRow );
		conversionApi.convertChildren( viewRow, childrenCursor );
	}

	if ( !viewRows.length ) {
		// Create empty table with one row and one table cell.
		const row = conversionApi.writer.createElement( 'tableRow' );

		conversionApi.writer.insert( row, ModelPosition.createAt( modelTable, 'end' ) );
		conversionApi.writer.insertElement( 'tableCell', ModelPosition.createAt( row, 'end' ) );
	}
}

// Scans <tr> and it's children for metadata:
// - For heading row:
//     - either add this row to heading or body rows.
//     - updates number of heading rows.
// - For body rows:
//     - calculates number of column headings.
// @param {module:engine/view/element~Element} tr
// @param {Object} tableMeta
// @param {module:engine/view/element~Element|undefined} firstThead
function scanRowForHeadingColumns( tr ) {
	let headingCols = 0;
	let index = 0;

	// Filter out empty text nodes from tr children.
	const children = Array.from( tr.getChildren() )
		.filter( child => child.name === 'th' || child.name === 'td' );

	// Count starting adjacent <th> elements of a <tr>.
	while ( index < children.length && children[ index ].name === 'th' ) {
		const td = children[ index ];

		// Adjust columns calculation by the number of spanned columns.
		const colspan = td.hasAttribute( 'colspan' ) ? parseInt( td.getAttribute( 'colspan' ) ) : 1;

		headingCols = headingCols + colspan;
		index++;
	}

	return headingCols;
}
