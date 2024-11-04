import { _decorator, Component, Mesh, MeshRenderer, Node, Vec3 } from 'cc';
import { GameMgr } from '../library/manager/GameMgr';
import { PlayerController } from '../controller/PlayerController';
import { PayZone } from '../library/controller/PayZone';
import { WorkZone } from '../controller/WorkZone';
import { GameState, GameStateMgr } from '../library/GameState';
import { TableController } from '../controller/TableController';
const { ccclass, property } = _decorator;

@ccclass('MyGameMgr')
export class MyGameMgr extends GameMgr {
    @property(PlayerController)
    player:PlayerController = null;

    @property(PayZone)
    payZones:PayZone[] = [];

    @property(WorkZone)
    workZones:WorkZone[] = [];

    @property(Node)
    moneyGroup:Node[] = [];

    @property(Node)
    inputGroup:Node[] = [];

    @property(Node)
    fieldPos:Node = null;

    @property(Node)
    tableGroup:Node = null;
    
    @property(Node)
    packShotMgr:Node = null;

    protected _tutorTargetNodeHistory:Node[] = [];
    protected _tables:TableController[] = null;
    protected _timer:number = 0;

    protected _arrowMeshRenderer:MeshRenderer = null;
    
    onLoad(): void {
        if (super.onLoad)
            super.onLoad();

        if (this.tableGroup)
            this._tables = this.tableGroup.getComponentsInChildren(TableController);

        if (this.arrow)
            this._arrowMeshRenderer = this.arrow.getComponent(MeshRenderer);
    }

    start(): void {
        if (super.start)
            super.start();

        // this.setTutorPos(this.fieldPos, true, true);
        this.showTutor(false);
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        this._timer += dt;

        if (this.player) {
            let done:boolean = false;

            const state = GameStateMgr.getState();
            const isFirstTableTrashTutor = GameState.TRASH_TUTOR <= state && state <= GameState.TRASH_TUTORING;
            let go2tutoring:boolean = false;

            const item = this.player.fetchItem();
            if (item) {
                for (let index = 0; index < this.workZones.length; index++) {
                    const element = this.workZones[index];
                    if (element && element.node.activeInHierarchy && element.workItemType == item.type) {
                        this.setTutorPos(element.node, false, true);
                        done = true;
                        go2tutoring = !isFirstTableTrashTutor || index == 1;
                        break;
                    }
                }
            } else {
                for (let index = 0; index < this._tables.length; index++) {
                    const table = this._tables[index];
                    if (table.needClean() || (isFirstTableTrashTutor && table.hasTrash())) {
                        this.setTutorPos(table.node, index == 0, false);
                        done = true;
                        go2tutoring = true;
                        break;
                    }
                }
    
                if (!done && !isFirstTableTrashTutor) {
                    if (this.player.hasMoney()) {
                        for (let index = 0; index < this.payZones.length; index++) {
                            const element = this.payZones[index];
                            if (element && element.node.activeInHierarchy) {
                                this.setTutorPos(element.node, index == 0, false, 1, 0);
                                done = true;
                                break;
                            }
                        }
                    } else if ((this.moneyGroup.length && this.moneyGroup[0].children.length > 0)/* || this.workZones[0].isSelling()*/)
                        this.setTutorPos(this.moneyGroup[0], false, false);
                    else if (this.workZones[0].hasGoods())
                        this.setTutorPos(this.workZones[0].node, false, false);
                    else if (this.inputGroup.length 
                        && this.inputGroup[0].children.length > 0 && this._timer > 5)
                        this.setTutorPos(this.inputGroup[0], false, false, 2);
                    // else
                    //     this.setTutorPos(this.fieldPos, true, true);
                }            
            }

            if (isFirstTableTrashTutor) {
                if (state == GameState.TRASH_TUTOR) {
                    if (go2tutoring)
                        GameStateMgr.setState(GameState.TRASH_TUTORING);
                    else if (!done)
                        this.arrow.active = false;
                }
            } else if (state > GameState.TRASH_TUTOR_DONE) {
                this.arrow.active = true;
                GameStateMgr.setState(GameState.NONE);
            }

            if (this.arrow.active) {
                const tutorDirection = GameMgr.getTutorialDirection(this.player.node.getWorldPosition());
                this.player.adjustTutorArrow(tutorDirection, dt);
            } else
                this.player.adjustTutorArrow(null, dt);
        }
    }

    protected setTutorPos(node:Node, followCamera:boolean, waitAction:boolean, materianIndex:number = 1, delay:number = 1) : Vec3 {
        const newPos = super.setTutorPos(node, followCamera, waitAction);
        if (newPos && this._arrowMeshRenderer) {
            this._arrowMeshRenderer.material = this._arrowMeshRenderer.materials[materianIndex];
        }
        
        if (followCamera && newPos && this.player && this._tutorTargetNodeHistory.indexOf(node) < 0) {
            if (waitAction && this._tutorTargetNodeHistory.length > 0)
                this.scheduleOnce(()=>{
                    this.player.setTutorTargetPos(newPos, 0.5);
                }, 0.5)
            else {
                if (delay > 0) {
                    this.scheduleOnce(()=>{
                        this.player.setTutorTargetPos(newPos, 0);
                    }, delay)
                } else
                    this.player.setTutorTargetPos(newPos, 0);
            }
            this._tutorTargetNodeHistory.push(node);
        }
        
        return newPos;
    }
}


