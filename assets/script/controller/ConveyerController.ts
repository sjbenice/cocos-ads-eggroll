import { _decorator, Component, instantiate, Node, Prefab, Quat, random, randomRange, tween, v3, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
import { Item } from '../library/controller/Item';
const { ccclass, property } = _decorator;

@ccclass('ConveyerController')
export class ConveyerController extends Component {
    @property(Prefab)
    itemPrefab:Prefab = null;

    @property(Node)
    pathGroup:Node = null;

    @property(Node)
    outputPos:Node = null;

    @property(Prefab)
    outputPrefab:Node = null;

    @property(Node)
    machine:Node = null;

    @property(Node)
    tempPos:Node = null;

    @property
    workCount:number = 0;

    protected static MAX_OUTPUT_COUNT:number = 10;
    protected static SPPED:number = 2;
    protected static PERIOD:number = 0.75;

    protected _timer:number = 0;
    protected _path:Vec3[] = [];

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _outputStartPos:Vec3 = v3(0, 0, -1);
    protected _outputEndPos:Vec3 = v3(0, 0, -0.5);

    protected _itemHeight : number = 0;

    start() {
        if (this.pathGroup) {
            this.pathGroup.children.forEach(child => {
                this._path.push(child.position);
            })
        }

        this.postChickenSfx();

        if (this.machine) {
            const orgScale = this.machine.getScale();
            const newScale = orgScale.clone().multiplyScalar(1.02);
            tween(this.machine)
            .to(0.5, {scale:newScale})
            .to(0.5, {scale:orgScale})
            .union()
            .repeatForever()
            .start();
        }
    }

    protected postChickenSfx() {
        SoundMgr.playSound('chicken_ko1');
        this.scheduleOnce(()=>{
            this.postChickenSfx();
        }, randomRange(3, 5));
    }

    update(deltaTime: number) {
        if (this.pathGroup) {
            this._timer += deltaTime;
            if (this._timer >= ConveyerController.PERIOD) {
                this._timer = 0;

                let product:Node = null;
                if (this.itemPrefab/* && random() < 0.5*/)
                    product = instantiate(this.itemPrefab);

                if (product) {
                    product.setParent(this.pathGroup.children[0]);
                    // product.setRotation(Quat.IDENTITY);

                    product.setWorldPosition(this._path[0]);
                    
                    const tw = tween(product);

                    for (let index = 1; index < this.pathGroup.children.length; index++) {
                        const element = this.pathGroup.children[index];
                        const targetPos = this._path[index];
                        this._tempPos.set(this._path[index - 1]);
                        this._tempPos.subtract(targetPos);
                        tw.to(this._tempPos.length() / ConveyerController.SPPED, {worldPosition:targetPos})
                        .call(()=>{
                            product.setParent(element);
                            product.setWorldPosition(targetPos);
                        })                        
                    }

                    tw.call(()=>{
                        product.removeFromParent();
                        product.destroy();

                        this.workCount ++;
                    })
                    .start();
                }

                if ((this.workCount > 0 && this.workCount % 2 == 0) 
                    && this.outputPos.children.length < ConveyerController.MAX_OUTPUT_COUNT) {
                    const good = instantiate(this.outputPrefab);
                    const item = good.getComponent(Item);
                    if (this._itemHeight == 0) {
                        if (item)
                            this._itemHeight = item.getHalfDimension().y * 2;
                    }
        
                    this.tempPos.addChild(good);
                    good.setPosition(this._outputStartPos);
                    tween(good)
                    .to(0.25, {position:this._outputEndPos})
                    .call(()=>{
                        good.setParent(this.outputPos);
                        
                        this._tempPos.set(Vec3.ZERO);
                        this._tempPos.y = (this.outputPos.children.length - 1) * this._itemHeight;
                        good.setPosition(this._tempPos);
                        item.scaleEffect(randomRange(0.2, 0.4));
                    })
                    .start();
                }
            }
        }

    }
}


