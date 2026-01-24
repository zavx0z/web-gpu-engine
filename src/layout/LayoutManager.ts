import YogaService, { YogaLoadingState } from './YogaService';
import { Object3D } from '../core/Object3D';

type YogaNode = any;

export class LayoutManager {
    private yogaService: YogaService;
    private objectToNodeMap = new Map<Object3D, YogaNode>();

    constructor() {
        this.yogaService = YogaService.instance;
    }

    private get yoga() {
        return this.yogaService.yoga;
    }

    public update(rootObject: Object3D, containerWidth: number, containerHeight: number, scale: number = 0.01): void {
        if (this.yogaService.state !== YogaLoadingState.READY) return;
        
        const rootNode = this.buildYogaTree(rootObject);
        if (!rootNode) return;

        // Calculate Layout
        // 0 corresponds to Direction.LTR
        rootNode.calculateLayout(containerWidth, containerHeight, this.yoga.Direction ? this.yoga.Direction.LTR : 0);
        
        this.applyLayout(rootObject, rootNode, scale);
    }

    private buildYogaTree(object: Object3D): YogaNode {
        let yogaNode = this.objectToNodeMap.get(object);
        
        if (!yogaNode) {
            if (!this.yoga.Node) {
                console.error("LayoutManager: this.yoga.Node is undefined! Check initialization.");
                return null;
            }
            yogaNode = this.yoga.Node.create();
            this.objectToNodeMap.set(object, yogaNode);
        }

        if (object.layout) {
            const { FlexDirection, Justify, Align, Edge } = this.yoga;

            if (object.layout.width !== undefined) yogaNode.setWidth(object.layout.width);
            if (object.layout.height !== undefined) yogaNode.setHeight(object.layout.height);
            
            if (object.layout.flexDirection) {
               const dir = object.layout.flexDirection;
               if (dir === 'row') yogaNode.setFlexDirection(FlexDirection.Row);
               if (dir === 'column') yogaNode.setFlexDirection(FlexDirection.Column);
               if (dir === 'row-reverse') yogaNode.setFlexDirection(FlexDirection.RowReverse);
               if (dir === 'column-reverse') yogaNode.setFlexDirection(FlexDirection.ColumnReverse);
            }
            
            if (object.layout.justifyContent) {
               const justify = object.layout.justifyContent;
               if (justify === 'flex-start') yogaNode.setJustifyContent(Justify.FlexStart);
               if (justify === 'center') yogaNode.setJustifyContent(Justify.Center);
               if (justify === 'flex-end') yogaNode.setJustifyContent(Justify.FlexEnd);
               if (justify === 'space-between') yogaNode.setJustifyContent(Justify.SpaceBetween);
               if (justify === 'space-around') yogaNode.setJustifyContent(Justify.SpaceAround);
            }
            
             if (object.layout.alignItems) {
               const align = object.layout.alignItems;
               if (align === 'flex-start') yogaNode.setAlignItems(Align.FlexStart);
               if (align === 'center') yogaNode.setAlignItems(Align.Center);
               if (align === 'flex-end') yogaNode.setAlignItems(Align.FlexEnd);
               if (align === 'stretch') yogaNode.setAlignItems(Align.Stretch);
               if (align === 'baseline') yogaNode.setAlignItems(Align.Baseline);
            }
            
            if (object.layout.padding !== undefined) yogaNode.setPadding(Edge.All, object.layout.padding);
            if (object.layout.margin !== undefined) yogaNode.setMargin(Edge.All, object.layout.margin);
        }

        // Reset children for the current frame to rebuild structure
        // Note: In a persistent object graph, this might be optimized by checking dirtiness,
        // but for now we ensure the Yoga tree matches the Object3D tree.
        while(yogaNode.getChildCount() > 0) {
            yogaNode.removeChild(yogaNode.getChild(0));
        }

        let childIndex = 0;
        for (const child of object.children) {
            if (child.layout) {
                const childYogaNode = this.buildYogaTree(child);
                if (childYogaNode) {
                    yogaNode.insertChild(childYogaNode, childIndex);
                    childIndex++;
                }
            }
        }

        return yogaNode;
    }

    private applyLayout(object: Object3D, yogaNode: YogaNode, scale: number): void {
        const left = yogaNode.getComputedLeft();
        const top = yogaNode.getComputedTop();
        
        // Convert 2D Layout coordinates (Top-Left 0,0, Y-down) to 3D (Center 0,0, Y-up)
        // We simply map Layout Top to negative Y in 3D.
        object.position.x = left * scale;
        object.position.y = -top * scale;
        
        object.updateMatrix();

        let childIndex = 0;
        for (const child of object.children) {
             if (child.layout) {
                const childYogaNode = yogaNode.getChild(childIndex);
                if (childYogaNode) {
                    this.applyLayout(child, childYogaNode, scale);
                }
                childIndex++;
            }
        }
    }
}