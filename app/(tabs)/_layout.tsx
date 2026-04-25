import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';

function tabIcon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 22, color }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMid,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: -2 },
        tabBarStyle: {
          backgroundColor: colors.bgTab,
          borderTopColor: colors.divider,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '記録', tabBarIcon: tabIcon('📷') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'カレンダー', tabBarIcon: tabIcon('📅') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: '設定', tabBarIcon: tabIcon('⚙️') }}
      />
    </Tabs>
  );
}
