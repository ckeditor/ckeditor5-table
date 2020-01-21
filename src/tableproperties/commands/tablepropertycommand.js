/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tableproperties/commands/tablepropertycommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';

import { findAncestor } from '../../commands/utils';

/**
 * The table cell attribute command.
 *
 * The command is a base command for other table cell attributes commands.
 *
 * @extends module:core/command~Command
 */
export default class TablePropertyCommand extends Command {
	/**
	 * Creates a new `TablePropertyCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor Editor on which this command will be used.
	 * @param {String} attributeName Table cell attribute name.
	 */
	constructor( editor, attributeName ) {
		super( editor );

		this.attributeName = attributeName;
	}

	/**
	 * @inheritDoc
	 */
	refresh() {
		const editor = this.editor;
		const selection = editor.model.document.selection;

		const table = findAncestor( 'table', selection.getFirstPosition() );

		this.isEnabled = !!table;
		this.value = this._getValue( table );
	}

	/**
	 * Executes the command.
	 *
	 * @fires execute
	 * @param {Object} [options]
	 * @param {*} [options.value] If set the command will set the attribute on selected table.
	 * If it is not set the command will remove the attribute from selected table.
	 * @param {module:engine/model/batch~Batch} [options.batch] Pass batch instance to the command for creating single undo step.
	 */
	execute( options = {} ) {
		const model = this.editor.model;
		const selection = model.document.selection;

		const { value, batch } = options;

		const table = findAncestor( 'table', selection.getFirstPosition() );

		model.enqueueChange( batch || 'default', writer => {
			if ( value ) {
				writer.setAttribute( this.attributeName, value, table );
			} else {
				writer.removeAttribute( this.attributeName, table );
			}
		} );
	}

	/**
	 * Returns attribute value for a table cell.
	 *
	 * @param {module:engine/model/element~Element} table
	 * @returns {String|undefined}
	 * @private
	 */
	_getValue( table ) {
		if ( !table ) {
			return;
		}

		return table.getAttribute( this.attributeName );
	}
}