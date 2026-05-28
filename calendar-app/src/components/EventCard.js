import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatTimeKr } from "../utils/calendarUtils";

export default function EventCard({ item, onPress, onEdit, onDelete }) {
  const Root = onPress ? TouchableOpacity : View;
  const rootProps = onPress ? { activeOpacity: 0.7, onPress } : {};
  return (
    <Root style={styles.card} {...rootProps}>
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <Text style={styles.time}>{item.allDay ? "하루 종일" : formatTimeKr(item.startDate)}</Text>
      </View>
      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
              <Ionicons name="pencil-outline" size={15} color="#4A90E2" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={15} color="#e74c3c" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </Root>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  dot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#4A90E2",
    marginTop: 4, marginRight: 10,
  },
  title: { fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  desc: { fontSize: 13, color: "#7f8c8d", marginTop: 2 },
  time: { fontSize: 12, color: "#aaa", marginTop: 4 },
  actions: { flexDirection: "row", gap: 4, marginLeft: 8 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5f6fa",
    justifyContent: "center", alignItems: "center",
  },
});
