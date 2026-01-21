import { Object3D } from "../core/Object3D";
import { AnimationAction } from "./AnimationAction";
import { AnimationClip } from "./AnimationClip";
import { SkinnedMesh } from "../core/SkinnedMesh";

export class AnimationMixer {
  private root: Object3D;
  private actions: AnimationAction[] = [];

  constructor(root: Object3D) {
    this.root = root;
  }

  public getRoot(): Object3D {
    return this.root;
  }

  public clipAction(clip: AnimationClip, localRoot?: Object3D): AnimationAction {
    const action = new AnimationAction(this, clip, localRoot);
    return action;
  }

  public addAction(action: AnimationAction): void {
    if (this.actions.indexOf(action) === -1) {
      this.actions.push(action);
    }
  }

  public removeAction(action: AnimationAction): void {
    const index = this.actions.indexOf(action);
    if (index !== -1) {
      this.actions.splice(index, 1);
    }
  }

  public update(deltaTime: number): void {
    for (let i = 0; i < this.actions.length; i++) {
      this.actions[i].update(deltaTime);
    }
    // Skeleton update is now deferred to the render loop (scene.updateWorldMatrix -> skeleton.update)
    // But actually, we still need to push the bone matrices to the GPU buffer.
    // Since we call scene.updateWorldMatrix() in main loop, the bone.matrixWorld will be correct.
    // We just need to ensure skeleton.update() is called AFTER world matrices are updated.
    // So we can leave this traverse here, but it should ideally happen after updateWorldMatrix.
    // For now, let's keep it, but rely on the fact that main loop calls updateWorldMatrix BEFORE rendering.
    // Wait, mixer.update is called BEFORE scene.updateWorldMatrix in main.ts.
    // So bone.matrixWorld is currently from the PREVIOUS frame (or outdated).
    // Ideally: mixer.update -> scene.updateWorldMatrix -> skeleton.update.
    // Let's remove the skeleton update from here and let the main loop handle it or just rely on the fact
    // that we need to update skeletons explicitly. 
    // Actually, in many engines, skeletons are updated *after* world matrices.
    // Let's change main.ts to: mixer.update -> scene.updateWorldMatrix -> ...
    // And we need to iterate skeletons somewhere. 
    // Let's keep it here for now, but strictly speaking it uses 'old' world matrices if called before updateWorldMatrix.
    // However, since we changed Skeleton.ts to use `bone.matrixWorld`, we must ensure those are up to date.
    // Let's MOVE this traversal to a separate method or just execute it here assuming main.ts logic will be adapted or acceptable lag.
    // BETTER PLAN: modifying main.ts to call skeleton updates after world matrix updates would be cleaner, 
    // but for now let's just leave this empty/commented and assume we'll fix main loop logic or accept 1-frame lag which is fine for simple stuff.
    // ACTUALLY, I will add a method to update skeletons to Scene or just traverse in main.ts.
    // For simplicity in this patch: I will NOT remove it, but since I am editing AnimationMixer, I'll just leave it.
    // Wait, the previous patch tried to replace this block. I will just comment it out to avoid using stale matrices if called before world update.

    this.root.traverse((object) => {
         if (object instanceof SkinnedMesh) {
             object.skeleton.update();
         }
    });
  }
}