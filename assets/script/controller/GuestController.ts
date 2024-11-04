import { _decorator, animation, Component, instantiate, Node, Prefab, Quat, randomRange, randomRangeInt, SkeletalAnimation, v3, Vec3 } from 'cc';
import { Emoji } from '../library/ui/Emoji';
import { OrderMark } from '../library/ui/OrderMark';
import { Billboard } from '../library/ui/Billboard';
import { Item } from '../library/controller/Item';
import { Utils } from '../library/util/Utils';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { TableController } from './TableController';
import { ItemType } from '../manager/ItemType';
import { GameState, GameStateMgr } from '../library/GameState';
const { ccclass, property } = _decorator;

@ccclass('GuestController')
export class GuestController extends Component {
    @property(Node)
    placePos:Node = null;
    
    @property(Emoji)
    emoji:Emoji = null;

    @property(OrderMark)
    order:OrderMark = null;

    @property
    orderType:number = 0;

    // @property
    protected orderMin:number = 1;
    // @property
    protected orderMax:number = 2;

    @property(Prefab)
    dollar:Prefab = null;

    @property(Prefab)
    trashPrefab:Prefab = null;

    @property
    speed:number = 5;

    protected angleSpeed:number = 2000;

    @property(SkeletalAnimation)
    anim:SkeletalAnimation = null;

    public static State = {
        NONE:-1,
        MOVING:0,
        WAITING:1,
        BUYING:2,
        PAYING:3,
        TO_TABLE:4,
        SIT_EAT:5,
        TO_BACK:6,
    };

    protected static BACKWARD:Vec3 = v3(0, 0, 1);
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();
    protected _tempQuat:Quat = Quat.IDENTITY.clone();

    protected _state:number = GuestController.State.NONE;

    protected _moving:boolean = false;

    protected _buyTimer:number = 0;
    protected _orderCount:number = 0;
    protected _totalPrice:number = 0;
    protected static BUY_INTERVAL:number = 0.05;

    protected _waitTime:number = 0;
    protected _maxWaitTime:number = 0;
    protected static MAX_WAIT_TIME:number = 30;

    protected _paying:boolean = false;

    protected _inPath:Node = null;
    protected _outPath:Node = null;

    protected _pathIndex:number = 0;
    protected _pathSubIndex:number = 0;

    protected _targetPathIndex:number = 0;

    private _curAnimName:string = null;
    private _animationController: animation.AnimationController;

    protected _tables:TableController[] = null;
    protected _eatPos:Node = null;
    protected _eatMovePos:Vec3 = Vec3.ZERO.clone();

    protected _orgParent:Node = null;

    public setup(cameraNode:Node, inPath:Node, outPath:Node, orderType:number, 
        tables:TableController[], startPathIndex:number, eulerRotation:Vec3) {
        if (this.order) {
            const billboard = this.order.getComponent(Billboard);
            if (billboard)
                billboard.cameraNode = cameraNode;
        }

        this._inPath = inPath;
        this._outPath = outPath;

        this._pathIndex = startPathIndex;
        if (this._inPath)
            this.node.setPosition(this._inPath.children[startPathIndex].getWorldPosition(this._tempPos));
        if (eulerRotation)
            this.node.setRotationFromEuler(eulerRotation);

        if (this.order) {
            this.order.node.active = false;
            this.orderType = orderType;
        }

        this._tables = tables;
    }

    public move2Index(inPathIndex:number) {
        this._targetPathIndex = inPathIndex;

        this._pathSubIndex = 0;

        this._state = GuestController.State.MOVING;

        if (this.getNextTargetPos(this._tempPos)) {
            this.moveTo(this._tempPos);
        }
    }

    public move2Table() : boolean {
        let placePos:Node = null;

        if (this._tables && this.isPaid()) {
            for (let index = 0; index < this._tables.length; index++) {
                const table = this._tables[index];
                if (table) {
                    placePos = table.takeEmptyPlace(this.node, this._eatMovePos);
                    if (placePos) {
                        break;
                    }
                }
            }
        }

        if (placePos) {
            this._eatPos = placePos;

            if (this.order)
                this.order.node.active = false;

            this._state = GuestController.State.TO_TABLE;

            this._pathIndex = 0;
            this._pathSubIndex = 0;
    
            if (this.getNextTargetPos(this._tempPos)) {
                this.moveTo(this._tempPos);
            }

            if (this.emoji && this.emoji.getType() <= Emoji.TYPE.TIRED)
                this.emoji.setType(Emoji.TYPE.SMILE);
        } else {
            if (this.order && !this.order.node.active) {
                this.order.setType(ItemType.NO_SEAT);
                this.order.setCount(0, true);
                this.order.node.active = true;
            }
        }

        return placePos != null;
    }

    public moveBack() {
        this._targetPathIndex = this._outPath.children.length - 1;

        this._pathIndex = 0;
        this._pathSubIndex = 0;

        this._state = GuestController.State.TO_BACK;

        if (this.getNextTargetPos(this._tempPos)) {
            this.moveTo(this._tempPos);
        }

        if (this.order)
            this.order.node.active = false;
    }

    public prepareBuy() {
        if (this.order)
            this.order.node.active = true;

        if (this.emoji)
            this.emoji.node.active = false;
    }

    public startBuy() {
        this.prepareBuy();

        this.topAnimation(false);

        this._state = GuestController.State.BUYING;
    }

    public checkBuy() : boolean {
        if (this._state == GuestController.State.BUYING) {
            if (this._orderCount == 0) {
                this._state = GuestController.State.PAYING;

                if (this.order && this.order.node.active) {
                    this.scheduleOnce(()=>{
                        this.order.node.active = false;
                    }, 0.5);
                }
            } else
                return true;
        }

        return false;
    }

    public buyGood(node:Node) {
        if (this._orderCount > 0 && node) {
            const item = node.getComponent(Item);
            if (item) {
                this.setAnimationValue('Heavy', true);

                this._orderCount --;
                if (this.order)
                    this.order.setCount(this._orderCount);
    
                node.setScale(Vec3.ONE);
                Utils.calcArrangePos(null, item.getHalfDimension(), this.placePos.children.length, this._tempPos);
    
                this.placePos.addChild(node);
                ParabolaTween.moveNodeParabola(node, this._tempPos, 2, 0.5, -1, 0, false);
    
                this._totalPrice += item.price;

                this.topAnimation(false);
            }
        }
    }

    public checkPay(placePos:Node, placeDimen:Vec3) : boolean {
        if (this._state == GuestController.State.PAYING) {
            if (this._totalPrice > 0 && placePos) {
                const cash = instantiate(this.dollar);
                const item = cash.getComponent(Item);
                this._totalPrice -= item.price;

                if (this._totalPrice < 0)
                    this._totalPrice = 0;

                placePos.addChild(cash);

                this.node.getWorldPosition(this._tempPos);
                cash.setWorldPosition(this._tempPos);

                Utils.calcArrangePos(placeDimen, item.getHalfDimension(), placePos.children.length - 1, this._tempPos);

                ParabolaTween.moveNodeParabola(cash, this._tempPos, 4, 0.5, -1, 0/*720*/, placePos.children.length > 100, this.arrangeDollarCallback);

                return true;
            }
        }

        return false;
    }

    protected arrangeDollarCallback(node:Node, param:any) {
        if (node) {
            const item = node.getComponent(Item);
            item.scaleEffect(randomRange(0.2, 0.4));
        }
    }

    public isPaid() : boolean {
        return this._state == GuestController.State.PAYING && this._totalPrice <= 0;
    }

    start() {
        if (animation.AnimationController) {
            this._animationController = this.node.getComponent(animation.AnimationController);
            if (!this._animationController)
                this._animationController = this.getComponentInChildren(animation.AnimationController);
        }

        this.topAnimation(true);

        if (this.order)
            this.order.setType(this.orderType);

        this.initWork();

        this._orgParent = this.node.parent;
    }

    protected initWork() {
        this._buyTimer = 0;
        this._orderCount = randomRangeInt(this.orderMin, this.orderMax + 1);
        if (this.order)
            this.order.setCount(this._orderCount);
        this._totalPrice = 0;
    
        this._waitTime = 0;
        if (this.emoji)
            this.emoji.setType(Emoji.TYPE.NONE);
        this._maxWaitTime = randomRange(GuestController.MAX_WAIT_TIME * 0.5, GuestController.MAX_WAIT_TIME);
    }

    protected moveTo(targetPos:Vec3) {
        this.topAnimation(true);

        this._targetPos.set(targetPos);
        this._targetPos.y = 0;

        this._moving = true;
    }

    public isArrived() : boolean {
        return this._state == GuestController.State.WAITING;
    }

    protected setAnimationName(newAnim:string) {
        if (this.anim && newAnim != this._curAnimName) {
            this.anim.play(newAnim);
            this._curAnimName = newAnim;
        }
    }

    protected topAnimation(start:boolean) {
        let name:string = start ? 'walk' : 'idle';
        if (this.placePos.children.length)
            name += 'Box';

        this.setAnimationValue('Speed', start ? this.speed : 0);
        this.setAnimationName(name);
    }

    protected setAnimationValue(tag:string, value:any){
        if (this._animationController)
            this._animationController.setValue(tag, value);
    }

    protected updateEmojiTime(deltaTime:number) {
        this._waitTime += deltaTime;

        const emojiType = Math.floor(this._waitTime * (Emoji.TYPE.ANGRY - Emoji.TYPE.TIRED + 1) / this._maxWaitTime);
        if (emojiType >= Emoji.TYPE.TIRED && this.emoji)
            this.emoji.setType(emojiType);
    }

    update(deltaTime: number) {
        if (this._moving) {
            this.node.getWorldPosition(this._tempPos);

            Vec3.subtract(this._velocity, this._targetPos, this._tempPos);
            const distance = this._velocity.lengthSqr();

            this._velocity.normalize();
            this._velocity.multiplyScalar(deltaTime * this.speed);
            this._tempPos.add(this._velocity);

            Utils.faceViewCommon(this._velocity, deltaTime, this.node, this.angleSpeed);                
            this.node.setWorldPosition(this._tempPos);

            if (this._velocity.length() >= distance) {
                if (this.getNextTargetPos(this._tempPos)) {
                    this.moveTo(this._tempPos);
                } else {
                    this.node.setWorldPosition(this._targetPos);
                    this._moving = false;
                }
            }
        }

        switch (this._state) {
            case GuestController.State.MOVING:
                if (!this._moving) {
                    this._state = GuestController.State.WAITING;
                    this.topAnimation(false);
                }
                break;
            case GuestController.State.TO_BACK:
                if (!this._moving) {
                    this.node.removeFromParent();
                    this.node.destroy();
                }
                break;
            case GuestController.State.WAITING:
                this.updateEmojiTime(deltaTime);
                break;
            case GuestController.State.TO_TABLE:
                if (!this._moving) {
                    this._state = GuestController.State.SIT_EAT;

                    this.topAnimation(false);
                    this.setAnimationValue('Heavy', false);
                    this.setAnimationValue('Sit', true);

                    this.emoji.setType(Emoji.TYPE.NONE);
                    this.emoji.setType(Emoji.TYPE.SMILE, -0.6);

                    const parent = this._eatPos.children[0];
                    for (let index = this.placePos.children.length - 1; index >= 0; index--) {
                        const good = this.placePos.children[index];
                        const item = good.getComponent(Item);
                        Utils.calcArrangePos(null, item.getHalfDimension(), parent.children.length, this._tempPos);
            
                        good.setParent(parent);
                        good.setPosition(this._tempPos);
                        item.scaleEffect();
                        item.enabled = false;                        
                    }

                    // this.node.setParent(this._eatPos);
                    this.node.setPosition(Vec3.ZERO);
                    this.node.setRotation(Quat.IDENTITY);

                    this._eatPos = null;

                    this.scheduleOnce(()=>{
                        this.setAnimationValue('Sit', false);

                        for (let index = parent.children.length - 1; index >= 0; index--) {
                            const good = parent.children[index];
                            good.removeFromParent();
                            good.destroy();
                        }

                        const trashObj = instantiate(this.trashPrefab);
                        parent.addChild(trashObj);
                        const trashItem = trashObj.getComponent(Item);
                        trashItem.scaleEffect();

                        this.node.setParent(this._orgParent);
                        this.node.setWorldPosition(this._eatMovePos);

                        this.moveBack();
                    }, 3);
                }
                break;
            case GuestController.State.SIT_EAT:
                break;
        }
    }

    protected getNextTargetPos(out:Vec3) : boolean {
        if (this._pathIndex == this._targetPathIndex)
            return false;

        const path = this._state >= GuestController.State.TO_TABLE ? this._outPath : this._inPath;
        if (0 <= this._pathIndex && this._pathIndex < path.children.length) {
            const pos = path.children[this._pathIndex];
            if (pos.children.length > 0 && this._pathSubIndex < pos.children.length) {
                pos.children[this._pathSubIndex ++].getWorldPosition(out);
                return true;
            } else
                this._pathSubIndex = 0;
            
            this._pathIndex ++;

            if (this._state == GuestController.State.TO_TABLE) {
                if (this._pathIndex == 2) {
                    // this._eatPos!.getWorldPosition(out);
                    out.set(this._eatMovePos);
                    out.z = path.children[this._pathIndex - 1].position.z;
                    return true;
                } else if (this._pathIndex == 3) {
                    out.set(this._eatMovePos);
                    return true;
                } else if (this._pathIndex == 4) {
                    this._pathIndex = 1;
                    return false;
                }
            } else if (this._state == GuestController.State.TO_BACK) {
                if (this._pathIndex == 1) {
                    this._outPath.children[this._pathIndex + 1].getWorldPosition(out);
                    const zPos = out.z;
                    out.set(this._eatMovePos);
                    out.z = zPos;
                    return true;
                }
            }

            if (this._pathIndex < path.children.length) {
                path.children[this._pathIndex].getWorldPosition(out);
                return true;
            }
        }

        return false;
    }

}


