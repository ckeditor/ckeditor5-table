/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/utils
 */

import { toWidget, isWidget } from '@ckeditor/ckeditor5-widget/src/utils';
import { getParentTable } from './commands/utils';

const tableSymbol = Symbol( 'isTable' );

/**
 * Converts a given {@link module:engine/view/element~Element} to a table widget:
 * * Adds a {@link module:engine/view/element~Element#_setCustomProperty custom property} allowing to recognize the table widget element.
 * * Calls the {@link module:widget/utils~toWidget} function with the proper element's label creator.
 *
 * @param {module:engine/view/element~Element} viewFigureElement
 * @param {module:engine/view/element~Element} viewTableElement
 * @param {module:engine/view/writer~Writer} writer An instance of the view writer.
 * @returns {module:engine/view/element~Element}
 */
export function toTableWidget( viewFigureElement, viewTableElement, writer ) {
	writer.setCustomProperty( tableSymbol, true, viewFigureElement );

	const figureWidet = toWidget( viewFigureElement, writer, { hasSelectionHandler: true } );

	// Due to a bug in Edge the `contenteditable=false` must be set on `<table>` element...
	writer.setAttribute( 'contenteditable', 'false', viewTableElement );
	// ...and the `<figure>` must have it set to `true` instead of removing `contenteditable` attribute.
	// https://github.com/ckeditor/ckeditor5/issues/1067
	writer.setAttribute( 'contenteditable', 'true', figureWidet );

	return figureWidet;
}

/**
 * Checks if a given view element is a table widget.
 *
 * @param {module:engine/view/element~Element} viewElement
 * @returns {Boolean}
 */
export function isTableWidget( viewElement ) {
	return !!viewElement.getCustomProperty( tableSymbol ) && isWidget( viewElement );
}

/**
 * Checks if a table widget is the only selected element.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {Boolean}
 */
export function isTableWidgetSelected( selection ) {
	const viewElement = selection.getSelectedElement();

	return !!( viewElement && isTableWidget( viewElement ) );
}

/**
 * Checks if a table widget content is selected.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {Boolean}
 */
export function isTableContentSelected( selection ) {
	const parentTable = getParentTable( selection.getFirstPosition() );

	return !!( parentTable && isTableWidget( parentTable.parent ) );
}
