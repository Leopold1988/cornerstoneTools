import external from './../../externalModules.js';
import EVENTS from './../../events.js';
import BaseTool from './BaseTool.js';
import isToolActive from './../../store/isToolActive.js';
import store from './../../store/index.js';
import { getToolState } from '../../stateManagement/toolState.js';

const { state, setters } = store.modules.brush;

/**
 * @abstract
 * @memberof Tools.Base
 * @classdesc Abstract class for tools which manipulate the mask data to be displayed on
 * the cornerstone canvas.
 * @extends Tools.Base.BaseTool
 */
class BaseBrushTool extends BaseTool {
  constructor({
    name,
    strategies,
    defaultStrategy,
    configuration,
    supportedInteractionTypes,
    mixins,
  }) {
    configuration.referencedToolData = 'brush';

    super({
      name,
      strategies,
      defaultStrategy,
      configuration,
      supportedInteractionTypes,
      mixins,
    });

    this.hasCursor = true;

    this._drawing = false;
    this._drawingMouseUpCallback = this._drawingMouseUpCallback.bind(this);

    //TEMP
    console.log(this.constructor.invalidateBrushOnEnabledElement);
    // TEMP
  }

  // ===================================================================
  // Abstract Methods - Must be implemented.
  // ===================================================================

  /**
   * Helper function for rendering the brush.
   *
   * @abstract
   * @param {Object} evt - The event.
   */
  renderBrush(evt) {
    throw new Error(`Method renderBrush not implemented for ${this.name}.`);
  }

  /**
   * Paints the data to the canvas.
   *
   * @protected
   * @abstract
   * @param  {Object} evt The event.
   */
  _paint(evt) {
    throw new Error(`Method _paint not implemented for ${this.name}.`);
  }

  // ===================================================================
  // Virtual Methods - Have default behavior but may be overriden.
  // ===================================================================

  /**
   * Event handler for MOUSE_DRAG event.
   *
   * @override
   * @event
   * @param {Object} evt - The event.
   */
  mouseDragCallback(evt) {
    this._startPainting(evt);
  }

  /**
   * Event handler for MOUSE_DOWN event.
   *
   * @override
   * @event
   * @param {Object} evt - The event.
   */
  preMouseDownCallback(evt) {
    this._startPainting(evt);

    return true;
  }

  /**
   * Initialise painting with baseBrushTool
   *
   * @protected
   * @event
   * @param {Object} evt - The event.
   */
  _startPainting(evt) {
    const eventData = evt.detail;
    const element = eventData.element;

    this._paint(evt);
    this._drawing = true;
    this._startListeningForMouseUp(element);
    this._lastImageCoords = eventData.currentPoints.image;
  }

  /**
   * Event handler for MOUSE_MOVE event.
   *
   * @override
   * @event
   * @param {Object} evt - The event.
   */
  mouseMoveCallback(evt) {
    const { currentPoints } = evt.detail;

    this._lastImageCoords = currentPoints.image;
  }

  /**
   * Event handler for switching mode to passive;
   *
   * @override
   * @event
   * @param {Object} evt - The event.
   */
  passiveCallback(evt) {
    external.cornerstone.updateImage(this.element);
  }

  /**
   * Used to redraw the tool's annotation data per render.
   *
   * @override
   * @param {Object} evt - The event.
   */
  renderToolData(evt) {
    const eventData = evt.detail;
    const element = eventData.element;

    // Only brush needs to render.
    if (isToolActive(element, this.name)) {
      // Call the hover event for the brush
      this.renderBrush(evt);
    }
  }

  // ===================================================================
  // Implementation interface
  // ===================================================================

  /**
   * Get the draw color (segmentation) of the tool.
   *
   * @protected
   * @param  {Number} drawId The id of the color (segmentation) to switch to.
   */
  _getBrushColor(drawId) {
    const colormap = external.cornerstone.colors.getColormap(state.colorMapId);
    const colorArray = colormap.getColor(drawId);

    if (this._drawing) {
      return `rgba(${colorArray[[0]]}, ${colorArray[[1]]}, ${
        colorArray[[2]]
      }, 1.0 )`;
    }

    return `rgba(${colorArray[[0]]}, ${colorArray[[1]]}, ${
      colorArray[[2]]
    }, 0.8 )`;
  }

  /**
   * Event handler for MOUSE_UP during the drawing event loop.
   *
   * @protected
   * @event
   * @param {Object} evt - The event.
   */
  _drawingMouseUpCallback(evt) {
    const eventData = evt.detail;
    const element = eventData.element;

    this._drawing = false;
    this._mouseUpRender = true;

    this._stopListeningForMouseUp(element);
  }

  /**
   * Adds modify loop event listeners.
   *
   * @protected
   * @param {Object} element - The viewport element to add event listeners to.
   * @modifies {element}
   */
  _startListeningForMouseUp(element) {
    element.removeEventListener(EVENTS.MOUSE_UP, this._drawingMouseUpCallback);
    element.removeEventListener(
      EVENTS.MOUSE_CLICK,
      this._drawingMouseUpCallback
    );

    element.addEventListener(EVENTS.MOUSE_UP, this._drawingMouseUpCallback);
    element.addEventListener(EVENTS.MOUSE_CLICK, this._drawingMouseUpCallback);

    external.cornerstone.updateImage(element);
  }

  /**
   * Adds modify loop event listeners.
   *
   * @protected
   * @param {Object} element - The viewport element to add event listeners to.
   * @modifies {element}
   */
  _stopListeningForMouseUp(element) {
    element.removeEventListener(EVENTS.MOUSE_UP, this._drawingMouseUpCallback);
    element.removeEventListener(
      EVENTS.MOUSE_CLICK,
      this._drawingMouseUpCallback
    );

    external.cornerstone.updateImage(element);
  }

  // ===================================================================
  // Segmentation API. This is effectively a wrapper around the store.
  // ===================================================================

  /**
   * Switches to the next segmentation color.
   *
   * @public
   * @api
   */
  nextSegmentation() {
    const numberOfColors = this.constructor.getNumberOfColors();

    let drawId = state.drawColorId + 1;

    if (drawId === numberOfColors) {
      drawId = 0;
    }

    state.drawColorId = drawId;
  }

  /**
   * Switches to the previous segmentation color.
   *
   * @public
   * @api
   */
  previousSegmentation() {
    const numberOfColors = this.constructor.getNumberOfColors();

    let drawId = state.drawColorId - 1;

    if (drawId < 0) {
      drawId = numberOfColors - 1;
    }

    state.drawColorId = drawId;
  }

  /**
   * Increases the brush size
   *
   * @public
   * @api
   */
  increaseBrushSize() {
    const oldRadius = state.radius;
    let newRadius = Math.floor(oldRadius * 1.2);

    // If e.g. only 2 pixels big. Math.floor(2*1.2) = 2.
    // Hence, have minimum increment of 1 pixel.
    if (newRadius === oldRadius) {
      newRadius += 1;
    }

    setters.radius(newRadius);
  }

  /**
   * Decreases the brush size
   *
   * @public
   * @api
   */
  decreaseBrushSize() {
    const oldRadius = state.radius;
    const newRadius = Math.floor(oldRadius * 0.8);

    setters.radius(newRadius);
  }

  /**
   * Displays a segmentation on the element.
   *
   * @public
   * @api
   * @param  {String} enabledElement  The enabledElement on which to display.
   * @param  {Number} segIndex        The index of the segmentation.
   */
  showSegmentationOnElement(segIndex) {
    const enabledElement = this._getEnabledElement();
    const enabledElementUID = enabledElement.uuid;

    setters.brushVisibilityForElement(enabledElementUID, segIndex, true);

    external.cornerstone.updateImage(enabledElement.element);
  }

  /**
   * Hides a segmentation on an element.
   *
   * @public
   * @api
   * @param  {Number} segIndex        The index of the segmentation.
   */
  hideSegmentationOnElement(segIndex) {
    const enabledElement = this._getEnabledElement();
    const enabledElementUID = enabledElement.uuid;

    setters.brushVisibilityForElement(enabledElementUID, segIndex, false);
    external.cornerstone.updateImage(enabledElement.element);
  }

  /**
   * Displays all segmentations on an element.
   *
   * @public
   * @api
   */
  showAllSegmentationsOnElement() {
    const enabledElement = this._getEnabledElement();
    const enabledElementUID = enabledElement.uuid;
    const colormap = external.cornerstone.colors.getColormap(state.colorMapId);
    const numberOfColors = colormap.getNumberOfColors();

    for (let segIndex = 0; segIndex < numberOfColors; segIndex++) {
      setters.brushVisibilityForElement(enabledElementUID, segIndex, true);
    }

    external.cornerstone.updateImage(enabledElement.element);
  }

  /**
   * Hides all segmentations on an element.
   *
   * @public
   * @api
   */
  hideAllSegmentationsOnElement() {
    const enabledElement = this._getEnabledElement();
    const enabledElementUID = enabledElement.uuid;
    const colormap = external.cornerstone.colors.getColormap(state.colorMapId);
    const numberOfColors = colormap.getNumberOfColors();

    for (let segIndex = 0; segIndex < numberOfColors; segIndex++) {
      setters.brushVisibilityForElement(enabledElementUID, segIndex, false);
    }

    external.cornerstone.updateImage(enabledElement.element);
  }

  /**
   * Returns the number of colors in the colormap.
   *
   * @static
   * @public
   * @api
   * @returns {Number} The number of colors in the color map.
   */
  static getNumberOfColors() {
    const colormap = external.cornerstone.colors.getColormap(state.colorMapId);

    return colormap.getNumberOfColors();
  }

  get alpha() {
    state.alpha;
  }

  set alpha(value) {
    const enabledElement = this._getEnabledElement();

    state.alpha = value;
    external.cornerstone.updateImage(enabledElement.element);
  }

  get hiddenButActiveAlpha() {
    state.hiddenButActiveAlpha;
  }

  set hiddenButActiveAlpha(value) {
    const enabledElement = this._getEnabledElement();

    state.hiddenButActiveAlpha = value;
    external.cornerstone.updateImage(enabledElement.element);
  }

  _getEnabledElement() {
    return external.cornerstone.getEnabledElement(this.element);
  }

  /**
   * Returns the toolData type assoicated with this type of tool.
   *
   * @static
   * @public
   * @returns {String} The number of colors in the color map.
   */
  static getReferencedToolDataName() {
    return 'brush';
  }

  /**
   * @static invalidateBrushOnEnabledElement - invalidate all the brush data.
   *
   * @returns {null}
   */
  static invalidateBrushOnEnabledElement(enabledElementUID) {
    console.log('test');

    console.log(store.state.enabledElements);

    const enabledElement = store.getters.enabledElementByUID(enabledElementUID);

    console.log(enabledElement);

    const stackToolState = getToolState(enabledElement, 'stack');

    console.log(stackToolState);

    if (!stackToolState) {
      return;
    }

    const imageIds = stackToolState.data[0].imageIds;

    const z = imageIds.length;

    //for (let i = 0; i < imageIds.length; i++) {}
  }

  /**
   * @static getDataAsVolume - Returns a datacube for the segmentation.
   *
   * @return {type}  description
   */
  static getDataAsVolume(cornerstoneEnabledElement) {
    // TODO -- grab imageID of the viewport
    // TODO - grab all slices.
    // TODO - aggregate data to a single Uint8ClampedArray of size x * y * z
    // TODO Return!
  }
}

export default BaseBrushTool;
