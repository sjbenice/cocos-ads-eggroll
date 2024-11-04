import { _decorator, Collider, Component, instantiate, Node, Prefab, Quat, randomRangeInt, v3, Vec3 } from 'cc';
import { WorkZone } from '../controller/WorkZone';
import { GuestController } from '../controller/GuestController';
import { ItemType } from './ItemType';
import event_html_playable from '../library/event_html_playable';
import { SoundMgr } from '../library/manager/SoundMgr';
import { TableController } from '../controller/TableController';
const { ccclass, property } = _decorator;

@ccclass('GuestMgr')
export class GuestMgr extends Component {
    @property(Prefab)
    guestPrefabs:Prefab[] = [];

    @property(Node)
    group:Node = null;

    @property(Node)
    inPath:Node = null;

    @property(Node)
    outPath:Node = null;

    @property(Node)
    cameraNode:Node = null;

    @property(WorkZone)
    workZone:WorkZone = null;

    @property(Node)
    moneyPlace:Node = null;

    @property
    inteval:number = 0.5;

    @property
    buyInterval:number = 0.3;

    @property(Node)
    packshotMgr:Node = null;

    @property(Node)
    tableGroup:Node = null;

    protected _guests:GuestController[] = [];
    protected _tables:TableController[] = null;

    protected _timer:number = 0;
    protected _buyTimer:number = 0;

    protected _moneyPlaceHafDimension:Vec3 = null;
    protected _lastGuestType:number = -1;

    start() {
        if (this.moneyPlace)
            this._moneyPlaceHafDimension = this.moneyPlace.getComponent(Collider).worldBounds.halfExtents;

        if (this.tableGroup)
            this._tables = this.tableGroup.getComponentsInChildren(TableController);

        if (this.inPath) {
            for (let index = 0; index < this.inPath.children.length; index++) {
                const guest = index > 1 ? this.createGuest(index, true) : null;
                if (guest)
                    guest.move2Index(index);

                this._guests.push(guest);
            }
        }
    }

    update(deltaTime: number) {
        this._buyTimer += deltaTime;
        if (this.workZone && this.workZone.hasPlayer() && this._buyTimer >= this.buyInterval) {
            this._buyTimer = 0;
            const firstGuest = this._guests[this._guests.length - 1];
            if (firstGuest) {
                if (firstGuest.checkPay(this.moneyPlace, this._moneyPlaceHafDimension)) {
                    if (firstGuest.isPaid()) {
                        SoundMgr.playSound('sell');

                        if (this.packshotMgr && !this.packshotMgr.active && event_html_playable.version() == 2)
                            this.packshotMgr.active = true;
                    }
                }
                if (firstGuest.checkBuy()) {
                    const good = this.workZone.sellGood();
                    if (good) {
                        firstGuest.buyGood(good);
                    }
                }
            } 
        }

        this._timer += deltaTime;
        if (this._timer >= this.inteval) {
            this._timer = 0;

            const firstGuest = this._guests[this._guests.length - 1];
            if (firstGuest) {
                if (firstGuest.isArrived()) {
                    firstGuest.startBuy();
                } else if (firstGuest.isPaid()) {
                    if (firstGuest.move2Table())
                        this._guests[this._guests.length - 1] = null;
                }
            }

            for (let i = this._guests.length - 1; i > 1; i--) {
                const guest = this._guests[i];
                if (guest == null) {
                    let nextGuest:GuestController = null;
                    for (let j = i - 1; j > 0; j--) {
                        nextGuest = this._guests[j];
                        if (nextGuest) {
                            this._guests[j] = null;
                            break;
                        }
                    }

                    if (!nextGuest) {
                        nextGuest = this.createGuest(i, false);
                    }

                    if (i == this._guests.length - 1)
                        nextGuest.prepareBuy();

                    nextGuest.move2Index(i);

                    this._guests[i] = nextGuest;
                    break;
                }
            }
        }
    }

    protected createGuest(posIndex:number, placeImmediately:boolean) : GuestController {
        let newGuestType:number = -1;
        while (true) {
            newGuestType = randomRangeInt(0, this.guestPrefabs.length);
            if (this._lastGuestType != newGuestType) {
                this._lastGuestType = newGuestType;
                break;
            }
        }
        const guest = instantiate(this.guestPrefabs[newGuestType]).getComponent(GuestController);
        this.group.addChild(guest.node);

        guest.setup(this.cameraNode, this.inPath, this.outPath, 
            ItemType.PIZZA, this._tables, 
            placeImmediately ? posIndex : 0, placeImmediately ? v3(0, 180, 0) : null);

        return guest;
    }
}



