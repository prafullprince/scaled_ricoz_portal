import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  PageHeader,
  PrimaryButton,
  SectionLabel,
  Surface,
} from "@/components/ui/primitives";

const PRINCIPLES = [
  {
    icon: "compass-outline",
    title: "Start with clarity",
    text: "We understand the business problem before choosing the technology.",
  },
  {
    icon: "layers-outline",
    title: "Build with focus",
    text: "We keep products useful, systems maintainable, and decisions grounded in outcomes.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Earn trust through delivery",
    text: "We value thoughtful communication, dependable execution, and long-term thinking.",
  },
] as const;

export function AboutView() {
  const router = useRouter();

  return (
    <ScrollView
      className="bg-canvas"
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
    >
      <PageHeader
        eyebrow="About Ricoz"
        title="Technology that makes the next step feel possible."
        description="Ricoz builds digital products and business technology solutions for teams that want to operate better, serve people well, and grow with confidence."
      />

      <Surface className="gap-2">
        <Text className="font-extra text-[11px] uppercase text-coral">
          What we believe
        </Text>
        <Text className="font-bold text-[17px] leading-6 text-ink">
          Useful technology is built around people and purpose.
        </Text>
        <Text className="font-sans text-[13px] leading-5 text-muted">
          Ricoz brings product thinking, engineering, and business understanding
          into one focused team. Our work spans products, customer experiences,
          internal systems, and practical digital transformation.
        </Text>
        <Text className="font-sans text-[13px] leading-5 text-muted">
          We do not believe in technology for its own sake. We believe in clear
          problems, careful decisions, and software that creates a better way to
          work.
        </Text>
      </Surface>

      <SectionLabel>How we work</SectionLabel>
      <Text className="font-sans text-[13px] leading-5 text-muted">
        A calm, practical approach to ambitious work.
      </Text>
      <View className="gap-2.5">
        {PRINCIPLES.map((principle) => (
          <Surface key={principle.title} className="gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-card bg-mint">
              <Ionicons color="#176B68" name={principle.icon} size={19} />
            </View>
            <Text className="font-bold text-[15px] text-ink">
              {principle.title}
            </Text>
            <Text className="font-sans text-[13px] leading-5 text-muted">
              {principle.text}
            </Text>
          </Surface>
        ))}
      </View>

      <Surface className="gap-3">
        <Text className="font-extra text-[11px] uppercase text-coral">
          Work with Ricoz
        </Text>
        <Text className="font-bold text-[17px] text-ink">
          Have a meaningful problem to solve?
        </Text>
        <PrimaryButton
          label="Start a conversation"
          onPress={() =>
            router.push({
              pathname: "/feature/[slug]",
              params: { slug: "contact" },
            })
          }
        />
        <Pressable
          className="h-11 items-center justify-center rounded-card border border-line bg-white active:opacity-70"
          onPress={() =>
            router.push({
              pathname: "/feature/[slug]",
              params: { slug: "services" },
            })
          }
        >
          <Text className="font-bold text-[13px] text-ink">
            Explore our services
          </Text>
        </Pressable>
      </Surface>
    </ScrollView>
  );
}
