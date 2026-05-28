import { useRef, useCallback } from "react";
import { Animated, PanResponder } from "react-native";

export default function useBottomSheet(collapsed, expanded, max) {
  const maxHeight = max ?? expanded;
  // 0 추가: 완전히 닫힌 상태도 스냅 포인트로 허용
  const snapPoints = max ? [0, collapsed, expanded, max] : [0, collapsed, expanded];

  const sheetAnim = useRef(new Animated.Value(collapsed)).current;
  const sheetHeightRef = useRef(collapsed);
  const isListAtTop = useRef(true);
  const snapFnRef = useRef(null);

  const snapTo = useCallback((toValue) => {
    sheetHeightRef.current = toValue;
    Animated.spring(sheetAnim, {
      toValue, tension: 70, friction: 12, useNativeDriver: false,
    }).start();
  }, [sheetAnim]);

  // snapSheet(true) always goes to expanded (auto-open height), false collapses
  const snapSheet = useCallback((expand) => {
    snapTo(expand ? expanded : collapsed);
  }, [snapTo, collapsed, expanded]);
  snapFnRef.current = snapSheet;

  const resolveSnap = (projected, vy) => {
    if (vy < -0.5) {
      // 위로 빠르게: 현재보다 높은 다음 지점으로
      return snapPoints.find(p => p > sheetHeightRef.current) ?? snapPoints[snapPoints.length - 1];
    }
    if (vy > 0.5) {
      // 아래로 빠르게: 현재보다 낮은 이전 지점으로
      return [...snapPoints].reverse().find(p => p < sheetHeightRef.current) ?? snapPoints[0];
    }
    // 가장 가까운 지점으로
    return snapPoints.reduce((prev, curr) =>
      Math.abs(curr - projected) < Math.abs(prev - projected) ? curr : prev
    );
  };

  // 핸들용: 위아래 드래그 모두 처리
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) => {
        if (Math.abs(dx) >= Math.abs(dy)) return false;
        if (dy > 0 && !isListAtTop.current) return false;
        return Math.abs(dy) > 8;
      },
      onPanResponderGrant: () => {
        sheetAnim.stopAnimation(v => { sheetHeightRef.current = v; });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(maxHeight, sheetHeightRef.current - dy));
        sheetAnim.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const projected = sheetHeightRef.current - dy;
        const target = resolveSnap(projected, vy);
        snapTo(target);
      },
    })
  ).current;

  // 리스트 영역용: 아래 방향 드래그만 캡처해서 시트 닫기
  const sheetBodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, { dy, dx }) => {
        if (Math.abs(dx) >= Math.abs(dy)) return false;
        if (!isListAtTop.current) return false; // 리스트가 스크롤된 상태면 캡처하지 않음
        return dy > 10;
      },
      onPanResponderGrant: () => {
        sheetAnim.stopAnimation(v => { sheetHeightRef.current = v; });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(maxHeight, sheetHeightRef.current - dy));
        sheetAnim.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const projected = sheetHeightRef.current - dy;
        const target = resolveSnap(projected, vy);
        snapTo(target);
      },
    })
  ).current;

  const onListScroll = useCallback(e => {
    isListAtTop.current = e.nativeEvent.contentOffset.y <= 0;
  }, []);

  return {
    sheetAnim,
    snapSheet,
    panHandlerProps: panResponder.panHandlers,
    sheetBodyPanHandlerProps: sheetBodyPanResponder.panHandlers,
    onListScroll,
  };
}
