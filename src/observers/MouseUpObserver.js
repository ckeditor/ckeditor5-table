import DomEventObserver from '@ckeditor/ckeditor5-engine/src/view/observer/domeventobserver';

class MouseUpObserver extends DomEventObserver {
	get domEventType() {
		return 'mouseup';
	}

	onDomEvent( domEvent ) {
		this.fire( 'mouseup', domEvent );
	}
}

export default MouseUpObserver;
