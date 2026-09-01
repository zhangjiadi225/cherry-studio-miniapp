import type { Camera, Vec2 } from '../../types';
import { CAMERA_ZOOM } from '../../constants';

export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: CAMERA_ZOOM,
    shakeX: 0,
    shakeY: 0,
    shakeDuration: 0,
    shakeIntensity: 0,
  };
}

export function updateCamera(cam: Camera, target: Vec2, dt: number) {
  cam.targetX = target.x;
  cam.targetY = target.y;
  // 直接跟随玩家位置，避免 lerp 导致摄像机与角色速度不匹配
  cam.x = cam.targetX;
  cam.y = cam.targetY;

  if (cam.shakeDuration > 0) {
    cam.shakeDuration -= dt;
    const intensity = cam.shakeIntensity * (cam.shakeDuration / 0.3);
    cam.shakeX = (Math.random() - 0.5) * intensity * 2;
    cam.shakeY = (Math.random() - 0.5) * intensity * 2;
  } else {
    cam.shakeX = 0;
    cam.shakeY = 0;
  }
}

export function shakeCamera(cam: Camera, duration: number, intensity: number) {
  cam.shakeDuration = Math.max(cam.shakeDuration, duration);
  cam.shakeIntensity = Math.max(cam.shakeIntensity, intensity);
}
