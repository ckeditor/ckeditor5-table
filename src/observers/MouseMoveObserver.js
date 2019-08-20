import DomEventObserver from '@ckeditor/ckeditor5-engine/src/view/observer/domeventobserver';

class MouseMoveObserver extends DomEventObserver {
	get domEventType() {
		return 'mousemove';
	}

	onDomEvent( domEvent ) {
		this.fire( 'mousemove', domEvent );
	}
}

export default MouseMoveObserver;
