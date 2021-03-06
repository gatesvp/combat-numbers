import _ from 'lodash';

/**
 * Coordinate any Token updates from the Foundry Hook system.
 */
export default class TokenUpdateCoordinator {
  constructor(layer, socketController, calculator) {
    this.layer = layer;
    this.socketController = socketController;
    this.calculator = calculator;
    this.queuedUpdates = new Map();
  }

  /**
   * Coordinate the pre-update functionality.
   *
   * @param {Object} entity
   *   The entity object about to be updated.
   */
  coordinatePreUpdate(entity) {
    const entityClone = _.cloneDeep(entity);

    // Store the update data for later when we see a full update.
    this.queuedUpdates.set(
      entityClone._id,
      entityClone,
    );
  }

  /**
   * Coordinate a token being updated.
   *
   * @param {Scene} scene
   *   The provided associated Scene object.
   * @param {Object} delta
   *   The provided delta of the Token data.
   */
  coordinateUpdate(scene, delta) {
    let hpDiff;
    const entityId = String(delta._id);

    // Let's find the previously stored delta.
    const entity = this.queuedUpdates.get(delta._id);

    if (!entity) {
      // Throw an error here?
      this._cleanQueuedUpdates(entityId);
      return;
    }

    try {
      hpDiff = this.calculator.getHpDiff(entity, delta);
    } catch (e) {
      // We may just not have been changing the HP attribute, or potentially it
      // doesn't exist. Either way, let's not continue.
      this._cleanQueuedUpdates(entityId);
      return;
    }

    if (hpDiff === 0) {
      this._cleanQueuedUpdates(entityId);
      return;
    }

    const coords = this.calculator.getCoordinates(scene, entity);

    this.layer.addCombatNumber(hpDiff, coords.x, coords.y);
    this.socketController.emit(hpDiff, coords.x, coords.y, scene._id);

    this._cleanQueuedUpdates(entityId);
  }

  /**
   * Determine if the relevant HP data does not exist within the Token entity.
   *
   * If not, we should be coordinating using the relevant Actor instead.
   *
   * @param token
   *   The Token Entity to check.
   *
   * @return {boolean}
   *   If we should use Actor coordination instead.
   */
  shouldUseActorCoordination(token) {
    return (
      _.get(token, 'actorData.data.attributes.hp.value', null) === null
    );
  }

  /**
   * Clean up any queued updates pertaining to the provided Entity ID.
   *
   * @param entityId
   *   The associated Entity ID with the queued update.
   *
   * @private
   */
  _cleanQueuedUpdates(entityId) {
    this.queuedUpdates.delete(entityId);
  }
}
