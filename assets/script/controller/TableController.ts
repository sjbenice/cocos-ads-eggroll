import { _decorator, Component, Node, ParticleSystem, Prefab, Quat, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
const { ccclass, property } = _decorator;

@ccclass('TableController')
export class TableController extends Component {
    @property(Node)
    placePos:Node = null;

    @property(Node)
    cleanState:Node = null;

    @property(ParticleSystem)
    cleanVfx:ParticleSystem = null;


    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempQuat:Quat = Quat.IDENTITY.clone();

    protected lateUpdate(dt: number): void {
        if (this.placePos) {
            let trashCount : number = 0;
            for (let index = 0; index < this.placePos.children.length; index++) {
                const placePos = this.placePos.children[index];
                if (placePos.children.length == 1 && placePos.children[0].children.length > 0) {
                    trashCount ++;
                }
            }

            if (trashCount == this.placePos.children.length) {
                if (this.cleanState && !this.cleanState.active)
                    this.cleanState.active = true;
            } else if (trashCount == 0) {
                if (this.cleanState && this.cleanState.active) {
                    this.cleanVfx.play();
                    this.cleanState.active = false;
                    SoundMgr.playSound("upgrade");
                }
            }
        }
    }

    public needClean() : boolean {
        return this.node.activeInHierarchy && this.cleanState && this.cleanState.active;
    }

    public hasTrash() : boolean {
        for (let index = 0; index < this.placePos.children.length; index++) {
            const place = this.placePos.children[index];
            if (place.children.length == 1) {// no guest?
                // check if trash
                if (place.children[0]!.children.length > 0)
                    return true;
            }
        }

        return false;
    }

    public takeEmptyPlace(guest:Node, outWorldMovePos:Vec3) : Node {
        let place:Node = null;

        if (this.node.active && this.placePos && this.cleanState && !this.cleanState.active) {
            for (let index = 0; index < this.placePos.children.length; index++) {
                place = this.placePos.children[index];
                if (place.children.length == 1) {// no guest?
                    // check if trash
                    if (place.children[0]!.children.length > 0)
                        place = null;
                    else {
                        if (guest) {
                            guest.getWorldPosition(this._tempPos);
                            guest.getWorldRotation(this._tempQuat);
                            guest.setParent(place);
                            guest.setWorldPosition(this._tempPos);
                            guest.setWorldRotation(this._tempQuat);

                            if (outWorldMovePos) {
                                place.getWorldPosition(outWorldMovePos);
                                outWorldMovePos.x += 1;//(index % 2 == 0) ? 1 : -1;
                            }
                        }
                        break;
                    }
                } else
                    place = null;
            }
        }
        return place;
    }
}


