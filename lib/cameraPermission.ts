import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  Camera,
  type CameraPermissionStatus,
} from 'react-native-vision-camera';

/**
 * カメラ権限の現在 status を返すフック。
 * AppState 復帰時に自動で再評価するので、ユーザーが端末設定で
 * 許可を切り替えた直後にもUIが反映される。
 */
export function useCameraPermissionStatus(): {
  status: CameraPermissionStatus;
  request: () => Promise<boolean>;
  refresh: () => void;
} {
  const [status, setStatus] = useState<CameraPermissionStatus>(() =>
    Camera.getCameraPermissionStatus(),
  );

  const refresh = useCallback(() => {
    setStatus(Camera.getCameraPermissionStatus());
  }, []);

  const request = useCallback(async () => {
    const result = await Camera.requestCameraPermission();
    setStatus(Camera.getCameraPermissionStatus());
    return result === 'granted';
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { status, request, refresh };
}
