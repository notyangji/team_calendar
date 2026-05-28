import { useRef, useState } from "react";
import { Animated, PanResponder, Dimensions } from "react-native";
import { today } from "../utils/calendarUtils";

const SCREEN_W = Dimensions.get("window").width;
const initialMonth = () => today.substring(0, 7) + "-01";

export default function useMonthSwipe() {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const displayMonthRef = useRef(initialMonth());
  const [displayMonth, setDisplayMonthState] = useState(initialMonth());

  // Expose a setDisplayMonth that keeps ref in sync (for onMonthChange arrow nav)
  const setDisplayMonth = (monthOrFn) => {
    const next = typeof monthOrFn === "function"
      ? monthOrFn(displayMonthRef.current)
      : monthOrFn;
    displayMonthRef.current = next;
    setDisplayMonthState(next);
  };

  // Animate to a target month. direction: 1 = forward (left slide), -1 = backward (right slide)
  const animateFnRef = useRef(null);
  animateFnRef.current = (targetMonth, direction) => {
    const exitX = direction * -SCREEN_W;
    const entryX = direction * SCREEN_W;

    Animated.timing(slideAnim, {
      toValue: exitX,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(entryX);
      displayMonthRef.current = targetMonth;
      setDisplayMonthState(targetMonth);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 120,
        friction: 16,
        useNativeDriver: true,
      }).start();
    });
  };

  const goToMonth = (targetMonth) => {
    if (displayMonthRef.current === targetMonth) return;
    const curr = new Date(displayMonthRef.current + "T12:00:00Z");
    const target = new Date(targetMonth + "T12:00:00Z");
    animateFnRef.current(targetMonth, target > curr ? 1 : -1);
  };

  const swipeHandlers = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15,
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) < 50) return;
        const goNext = dx < 0;
        const d = new Date(displayMonthRef.current + "T12:00:00Z");
        if (goNext) d.setUTCMonth(d.getUTCMonth() + 1);
        else d.setUTCMonth(d.getUTCMonth() - 1);
        d.setUTCDate(1);
        animateFnRef.current(d.toISOString().split("T")[0], goNext ? 1 : -1);
      },
    })
  ).current.panHandlers;

  return { displayMonth, setDisplayMonth, goToMonth, slideAnim, swipeHandlers };
}
