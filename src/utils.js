/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/utils
 */

import { isWidget, toWidget } from '@ckeditor/ckeditor5-widget/src/utils';
import { findAncestor } from './commands/utils';

/**
 * Converts a given {@link module:engine/view/element~Element} to a table widget:
 * * Adds a {@link module:engine/view/element~Element#_setCustomProperty custom property} allowing to recognize the table widget element.
 * * Calls the {@link module:widget/utils~toWidget} function with the proper element's label creator.
 *
 * @param {module:engine/view/element~Element} viewElement
 * @param {module:engine/view/downcastwriter~DowncastWriter} writer An instance of the view writer.
 * @param {String} label The element's label. It will be concatenated with the table `alt` attribute if one is present.
 * @returns {module:engine/view/element~Element}
 */
export function toTableWidget( viewElement, writer ) {
	return toWidget( viewElement, writer, { hasSelectionHandler: true } );
}

/**
 * Checks if a given view element is a table widget.
 *
 * @param {module:engine/view/element~Element} viewElement
 * @returns {Boolean}
 */
export function isTableWidget( viewElement ) {
	return isWidget( viewElement ) && viewElement.hasClass( 'table' );
}

/**
 * Returns a table widget editing view element if one is selected.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {module:engine/view/element~Element|null}
 */
export function getSelectedTableWidget( selection ) {
	const viewElement = selection.getSelectedElement();

	if ( viewElement && isTableWidget( viewElement ) ) {
		return viewElement;
	}

	return null;
}

/**
 * Returns a table widget editing view element if one is among selection's ancestors.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {module:engine/view/element~Element|null}
 */
export function getTableWidgetAncestor( selection ) {
	const parentTable = findAncestor( 'table', selection.getFirstPosition() );

	if ( parentTable && isTableWidget( parentTable.parent ) ) {
		return parentTable.parent;
	}

	return null;
}
