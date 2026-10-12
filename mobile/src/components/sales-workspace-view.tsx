import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { FormScrollView as ScrollView } from "@/components/ui/form-scroll-view";

import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { colors } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/api";
import { salesService } from "@/services/sales.service";
import type {
  CreateSalesLeadInput,
  CreateSalesTaskInput,
  SalesDashboard,
  SalesLead,
  SalesLeadPriority,
  SalesLeadSource,
  SalesTask,
  SalesTaskPriority,
} from "@/types/sales";

type SalesTab = "dashboard" | "work" | "leads" | "team";
const sources: SalesLeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "GOOGLE",
  "LINKEDIN",
  "META",
  "INSTAGRAM",
  "EMAIL",
  "COLD_CALLING",
  "OTHER",
];
const priorities: SalesLeadPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const taskPriorities: SalesTaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const leadStages = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "REQUIREMENT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
const initialLead: CreateSalesLeadInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  source: "WEBSITE",
  priority: "MEDIUM",
  expectedValue: 0,
  serviceInterest: "",
  notes: "",
};

const money = (minorUnits: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

export function SalesWorkspaceView() {
  const [tab, setTab] = useState<SalesTab>("dashboard");
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [assigningLead, setAssigningLead] = useState<SalesLead | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [nextDashboard, nextLeads] = await Promise.all([
        salesService.dashboard(),
        salesService.leads(),
      ]);
      setDashboard(nextDashboard);
      setLeads(nextLeads);
    } catch (error) {
      Alert.alert(
        "Sales Workspace",
        getApiErrorMessage(error, "Unable to load Sales data."),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, []);

  const completeTask = async (task: SalesTask) => {
    setBusyId(task._id);
    try {
      await salesService.completeTask(task._id);
      await load();
    } catch (error) {
      Alert.alert(
        "Complete task",
        getApiErrorMessage(error, "Unable to complete this task."),
      );
    } finally {
      setBusyId(null);
    }
  };

  const assignLead = async (ownerId: string) => {
    if (!assigningLead) return;
    setBusyId(ownerId);
    try {
      await salesService.assignLead(assigningLead._id, ownerId);
      setAssigningLead(null);
      await load();
      Alert.alert("Lead assigned", "The owner has been updated successfully.");
    } catch (error) {
      Alert.alert(
        "Assign lead",
        getApiErrorMessage(error, "Unable to assign this lead."),
      );
    } finally {
      setBusyId(null);
    }
  };

  const advanceLead = async (lead: SalesLead) => {
    const currentIndex = leadStages.indexOf(
      lead.status as (typeof leadStages)[number],
    );
    const nextStatus =
      leadStages[
        Math.min(Math.max(0, currentIndex) + 1, leadStages.length - 1)
      ];
    if (nextStatus === lead.status) return;
    setBusyId(lead._id);
    try {
      await salesService.updateLeadStatus(lead._id, nextStatus);
      await load();
    } catch (error) {
      Alert.alert(
        "Update lead",
        getApiErrorMessage(error, "Unable to update the lead stage."),
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#0D3FA3" size="large" />
        <Text className="mt-3 font-medium text-sm text-muted">
          Loading Sales workspace...
        </Text>
      </View>
    );
  if (!dashboard)
    return (
      <View className="flex-1 bg-canvas px-5">
        <EmptyState
          icon="cloud-offline-outline"
          title="Sales workspace unavailable"
          description="Refresh to try loading your Sales data again."
        />
        <Pressable
          className="h-12 items-center justify-center rounded-card bg-ink"
          onPress={() => void load()}
        >
          <Text className="font-bold text-white">Try again</Text>
        </Pressable>
      </View>
    );

  const persona =
    dashboard.designation === "SALES_HEAD"
      ? "Sales Head"
      : dashboard.designation === "SALES_MANAGER"
        ? "Sales Manager"
        : `Sales Executive · ${dashboard.employmentType === "INTERN" ? "Intern" : "Employee"}`;
  const canManageTeam = dashboard.scope !== "OWN";

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#0D3FA3"
            onRefresh={() => void load(true)}
          />
        }
        contentContainerClassName="px-5 pb-12 pt-5"
      >
        <PageHeader
          eyebrow={persona}
          title="Sales Workspace"
          description="Leads, pipeline, assigned work and team activity."
          action={
            <Pressable
              accessibilityLabel="Add lead"
              className="h-10 w-10 items-center justify-center rounded-card bg-[#0D3FA3]"
              onPress={() => setLeadModalOpen(true)}
            >
              <Ionicons color={colors.white} name="add" size={22} />
            </Pressable>
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 mt-4"
          contentContainerClassName="gap-2 px-5"
        >
          {(
            [
              "dashboard",
              "work",
              "leads",
              ...(canManageTeam ? ["team" as const] : []),
            ] as SalesTab[]
          ).map((item) => (
            <Pressable
              key={item}
              className={`h-10 justify-center rounded-card px-4 ${tab === item ? "bg-[#0D3FA3]" : "border border-line bg-white"}`}
              onPress={() => setTab(item)}
            >
              <Text
                className={`font-bold text-xs capitalize ${tab === item ? "text-white" : "text-muted"}`}
              >
                {item === "work" ? "My Work" : item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === "dashboard" ? (
          <DashboardTab
            canAssign={canManageTeam}
            dashboard={dashboard}
            onAssignWork={() => setTaskModalOpen(true)}
            onOpenWork={() => setTab("work")}
          />
        ) : null}
        {tab === "work" ? (
          <WorkTab
            busyId={busyId}
            tasks={dashboard.tasks}
            onComplete={completeTask}
          />
        ) : null}
        {tab === "leads" ? (
          <LeadsTab
            busyId={busyId}
            canAssign={canManageTeam}
            leads={leads}
            onAdd={() => setLeadModalOpen(true)}
            onAdvance={advanceLead}
            onAssign={setAssigningLead}
          />
        ) : null}
        {tab === "team" && canManageTeam ? (
          <TeamTab dashboard={dashboard} />
        ) : null}
      </ScrollView>
      <CreateLeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onCreated={async () => {
          setLeadModalOpen(false);
          await load();
          setTab("leads");
        }}
      />
      <CreateTaskModal
        dashboard={dashboard}
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreated={async () => {
          setTaskModalOpen(false);
          await load();
          setTab("work");
        }}
      />
      <AssignLeadModal
        dashboard={dashboard}
        lead={assigningLead}
        busyId={busyId}
        onClose={() => setAssigningLead(null)}
        onAssign={assignLead}
      />
    </>
  );
}

function DashboardTab({
  canAssign,
  dashboard,
  onAssignWork,
  onOpenWork,
}: {
  canAssign: boolean;
  dashboard: SalesDashboard;
  onAssignWork: () => void;
  onOpenWork: () => void;
}) {
  const maxCount = Math.max(1, ...dashboard.pipeline.map((item) => item.count));
  return (
    <View className="mt-5 gap-5">
      {canAssign ? (
        <Pressable
          className="h-12 flex-row items-center justify-center gap-2 rounded-card bg-[#0D3FA3]"
          onPress={onAssignWork}
        >
          <Ionicons color={colors.white} name="add-circle-outline" size={18} />
          <Text className="font-bold text-sm text-white">
            Assign Sales Work
          </Text>
        </Pressable>
      ) : null}
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <Kpi
          icon="people-outline"
          label="Total Leads"
          value={String(dashboard.metrics.totalLeads)}
          detail={`${dashboard.metrics.qualifiedLeads} qualified`}
          color="#0D3FA3"
        />
        <Kpi
          icon="analytics-outline"
          label="Pipeline"
          value={money(dashboard.metrics.pipelineValue)}
          detail={`${dashboard.metrics.openDeals} active`}
          color={colors.teal}
        />
        <Kpi
          icon="checkmark-done-outline"
          label="Pending Work"
          value={String(dashboard.metrics.pendingTasks)}
          detail={`${dashboard.metrics.dueToday} due today`}
          color="#B7791F"
        />
        <Kpi
          icon="warning-outline"
          label="Overdue"
          value={String(dashboard.metrics.overdueTasks)}
          detail={`${dashboard.metrics.completedTasks} completed`}
          color={colors.danger}
        />
      </View>
      <View className="rounded-card border border-line bg-white p-4">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="font-bold text-base text-ink">Lead funnel</Text>
            <Text className="mt-1 font-sans text-xs text-muted">
              Active leads by stage
            </Text>
          </View>
          <Text className="font-bold text-xs text-[#0D3FA3]">
            {dashboard.metrics.conversionRate}% conversion
          </Text>
        </View>
        <View className="mt-5 h-44 flex-row items-end justify-between gap-2 border-b border-line px-1">
          {dashboard.pipeline.slice(0, 6).map((item) => (
            <View key={item.stage} className="flex-1 items-center gap-2">
              <Text className="font-bold text-[9px] text-muted">
                {item.count}
              </Text>
              <View
                className="w-full rounded-t-sm bg-[#18A34A]"
                style={{ height: Math.max(8, (item.count / maxCount) * 120) }}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="w-full text-center font-medium text-[8px] text-muted"
              >
                {item.stage}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="rounded-card border border-line bg-white p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-base text-ink">
            Today&apos;s work
          </Text>
          <Pressable onPress={onOpenWork}>
            <Text className="font-bold text-xs text-[#0D3FA3]">View all</Text>
          </Pressable>
        </View>
        {dashboard.tasks
          .filter((task) => task.status === "PENDING")
          .slice(0, 3)
          .map((task) => (
            <TaskRow key={task._id} task={task} />
          ))}
        {!dashboard.tasks.some((task) => task.status === "PENDING") ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Work is clear"
            description="No pending Sales tasks in your current scope."
          />
        ) : null}
      </View>
    </View>
  );
}

function Kpi({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <View className="min-h-28 w-[48.5%] justify-between rounded-card border border-line bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-[10px] uppercase text-muted">
          {label}
        </Text>
        <Ionicons color={color} name={icon} size={18} />
      </View>
      <View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          className="font-extra text-2xl text-ink"
        >
          {value}
        </Text>
        <Text className="mt-1 font-medium text-[10px] text-muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

function WorkTab({
  tasks,
  busyId,
  onComplete,
}: {
  tasks: SalesTask[];
  busyId: string | null;
  onComplete: (task: SalesTask) => Promise<void>;
}) {
  const pending = tasks.filter((task) => task.status === "PENDING");
  return (
    <View className="mt-5 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-lg text-ink">Assigned work</Text>
        <View className="rounded-full bg-[#0D3FA3] px-2.5 py-1">
          <Text className="font-bold text-xs text-white">{pending.length}</Text>
        </View>
      </View>
      {pending.map((task) => (
        <View
          key={task._id}
          className="rounded-card border border-line bg-white p-4"
        >
          <TaskRow task={task} />
          <View className="mt-3 flex-row gap-2 border-t border-line pt-3">
            <Pressable className="h-10 flex-1 items-center justify-center rounded-card bg-[#0D3FA3]">
              <Text className="font-bold text-xs text-white">Take Action</Text>
            </Pressable>
            <Pressable
              disabled={busyId === task._id}
              className="h-10 flex-1 items-center justify-center rounded-card border border-line disabled:opacity-50"
              onPress={() => void onComplete(task)}
            >
              {busyId === task._id ? (
                <ActivityIndicator color={colors.teal} />
              ) : (
                <Text className="font-bold text-xs text-muted">Mark Done</Text>
              )}
            </Pressable>
          </View>
        </View>
      ))}
      {!pending.length ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="No pending work"
          description="New assignments from your manager will appear here."
        />
      ) : null}
    </View>
  );
}

function TaskRow({ task }: { task: SalesTask }) {
  const overdue = task.effectiveStatus === "OVERDUE";
  return (
    <View className="mt-3 flex-row gap-3">
      <View
        className={`h-10 w-10 items-center justify-center rounded-card ${overdue ? "bg-red-50" : "bg-mint"}`}
      >
        <Ionicons
          color={overdue ? colors.danger : colors.teal}
          name={overdue ? "alert-circle-outline" : "checkbox-outline"}
          size={20}
        />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-sm text-ink">{task.title}</Text>
        <Text
          numberOfLines={2}
          className="mt-1 font-sans text-xs leading-4 text-muted"
        >
          {task.description}
        </Text>
        <Text
          className={`mt-2 font-bold text-[10px] ${overdue ? "text-red-600" : "text-teal"}`}
        >
          {overdue ? "OVERDUE · " : "DUE · "}
          {dateLabel(task.deadline)}
        </Text>
      </View>
    </View>
  );
}

function LeadsTab({
  leads,
  busyId,
  canAssign,
  onAdd,
  onAdvance,
  onAssign,
}: {
  leads: SalesLead[];
  busyId: string | null;
  canAssign: boolean;
  onAdd: () => void;
  onAdvance: (lead: SalesLead) => Promise<void>;
  onAssign: (lead: SalesLead) => void;
}) {
  return (
    <View className="mt-5 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-lg text-ink">Leads</Text>
        <Pressable className="flex-row items-center gap-1" onPress={onAdd}>
          <Ionicons color="#0D3FA3" name="add-circle-outline" size={18} />
          <Text className="font-bold text-xs text-[#0D3FA3]">Add Lead</Text>
        </Pressable>
      </View>
      {leads.map((lead) => (
        <View
          key={lead._id}
          className="rounded-card border border-line bg-white p-4"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-bold text-sm text-ink">{lead.name}</Text>
              <Text className="mt-1 font-sans text-xs text-muted">
                {lead.company || lead.phone}
              </Text>
            </View>
            <View className="rounded-sm bg-green-50 px-2 py-1">
              <Text className="font-bold text-[9px] text-green-700">
                {lead.status}
              </Text>
            </View>
          </View>
          <View className="mt-3">
            <Text className="font-extra text-base text-ink">
              {money(lead.expectedValue)}
            </Text>
            <Text className="mt-1 font-medium text-[10px] text-muted">
              Owner: {lead.ownerId?.name ?? "Unassigned"} · {lead.source}
            </Text>
          </View>
          <View className="mt-3 flex-row gap-2 border-t border-line pt-3">
            <Pressable
              disabled={
                busyId === lead._id ||
                lead.status === "LOST" ||
                lead.status === "WON"
              }
              className="h-10 flex-1 items-center justify-center rounded-card bg-[#0D3FA3] disabled:opacity-40"
              onPress={() => void onAdvance(lead)}
            >
              {busyId === lead._id ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text className="font-bold text-xs text-white">
                  Advance Stage
                </Text>
              )}
            </Pressable>
            {canAssign ? (
              <Pressable
                className="h-10 flex-1 items-center justify-center rounded-card border border-[#0D3FA3]"
                onPress={() => onAssign(lead)}
              >
                <Text className="font-bold text-xs text-[#0D3FA3]">Assign</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {!leads.length ? (
        <EmptyState
          icon="people-outline"
          title="No leads yet"
          description="Create the first lead to start the Sales pipeline."
        />
      ) : null}
    </View>
  );
}

function TeamTab({ dashboard }: { dashboard: SalesDashboard }) {
  const members = dashboard.team.filter((member) => member.level === "MEMBER");
  return (
    <View className="mt-5 gap-3">
      <Text className="font-bold text-lg text-ink">My team</Text>
      {members.map((member) => (
        <View
          key={member.user._id}
          className="rounded-card border border-line bg-white p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-[#0D3FA3]">
              <Text className="font-extra text-sm text-white">
                {member.user.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-ink">
                {member.user.name}
              </Text>
              <Text className="mt-1 font-medium text-[10px] text-muted">
                Sales Executive ·{" "}
                {member.employmentType === "INTERN" ? "Intern" : "Employee"}
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row justify-between border-t border-line pt-3">
            <TeamMetric label="Active" value={member.activeTasks} />
            <TeamMetric label="Completed" value={member.completedTasks} />
            <TeamMetric
              danger={member.overdueTasks > 0}
              label="Overdue"
              value={member.overdueTasks}
            />
          </View>
        </View>
      ))}
      {!members.length ? (
        <EmptyState
          icon="people-outline"
          title="No team assigned"
          description="Sales Executives assigned under you will appear here."
        />
      ) : null}
    </View>
  );
}

function TeamMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <View>
      <Text
        className={`font-extra text-lg ${danger ? "text-red-600" : "text-ink"}`}
      >
        {value}
      </Text>
      <Text className="font-medium text-[10px] text-muted">{label}</Text>
    </View>
  );
}

function CreateLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateSalesLeadInput>(initialLead);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CreateSalesLeadInput>(
    key: K,
    next: CreateSalesLeadInput[K],
  ) => setForm((current) => ({ ...current, [key]: next }));
  const submit = async () => {
    if (form.name.trim().length < 2 || form.phone.trim().length < 7) {
      Alert.alert("Add lead", "Enter a valid name and phone number.");
      return;
    }
    setBusy(true);
    try {
      await salesService.createLead({
        ...form,
        expectedValue: Math.round((Number(value) || 0) * 100),
      });
      setForm(initialLead);
      setValue("");
      await onCreated();
      Alert.alert("Lead created", "The lead is now in your Sales pipeline.");
    } catch (error) {
      Alert.alert(
        "Add lead",
        getApiErrorMessage(error, "Unable to create this lead."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={open}
    >
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-3 px-5 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-extra text-2xl text-ink">Add Lead</Text>
            <Text className="mt-1 font-sans text-xs text-muted">
              Create a new Sales opportunity.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-card border border-line bg-white"
            onPress={onClose}
          >
            <Ionicons color={colors.ink} name="close" size={20} />
          </Pressable>
        </View>
        <FormInput
          label="Lead name *"
          value={form.name}
          onChangeText={(next) => set("name", next)}
        />
        <FormInput
          label="Phone *"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(next) => set("phone", next)}
        />
        <FormInput
          label="Company"
          value={form.company}
          onChangeText={(next) => set("company", next)}
        />
        <FormInput
          label="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(next) => set("email", next)}
        />
        <FormInput
          label="Service interest"
          value={form.serviceInterest}
          onChangeText={(next) => set("serviceInterest", next)}
        />
        <FormInput
          label="Expected value (INR)"
          keyboardType="numeric"
          value={value}
          onChangeText={setValue}
        />
        <Text className="mt-2 font-bold text-xs text-ink">Lead source</Text>
        <View className="flex-row flex-wrap gap-2">
          {sources.map((source) => (
            <Choice
              key={source}
              active={form.source === source}
              label={source.replaceAll("_", " ")}
              onPress={() => set("source", source)}
            />
          ))}
        </View>
        <Text className="mt-2 font-bold text-xs text-ink">Priority</Text>
        <View className="flex-row flex-wrap gap-2">
          {priorities.map((priority) => (
            <Choice
              key={priority}
              active={form.priority === priority}
              label={priority}
              onPress={() => set("priority", priority)}
            />
          ))}
        </View>
        <FormInput
          label="Notes"
          multiline
          value={form.notes}
          onChangeText={(next) => set("notes", next)}
        />
        <Pressable
          disabled={busy}
          className="mt-3 h-14 items-center justify-center rounded-card bg-[#0D3FA3] disabled:opacity-50"
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text className="font-bold text-white">Create Lead</Text>
          )}
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

function AssignLeadModal({
  dashboard,
  lead,
  busyId,
  onClose,
  onAssign,
}: {
  dashboard: SalesDashboard;
  lead: SalesLead | null;
  busyId: string | null;
  onClose: () => void;
  onAssign: (ownerId: string) => Promise<void>;
}) {
  const members = dashboard.team.filter((member) => member.level === "MEMBER");
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={Boolean(lead)}
    >
      <View className="flex-1 bg-canvas px-5 pb-10 pt-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-extra text-2xl text-ink">Assign Lead</Text>
            <Text className="mt-1 font-sans text-xs text-muted">
              {lead?.name}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-card border border-line bg-white"
            onPress={onClose}
          >
            <Ionicons color={colors.ink} name="close" size={20} />
          </Pressable>
        </View>
        <ScrollView className="mt-5">
          {members.map((member) => (
            <Pressable
              key={member.user._id}
              disabled={Boolean(busyId)}
              className="mb-3 flex-row items-center gap-3 rounded-card border border-line bg-white p-4 disabled:opacity-50"
              onPress={() => void onAssign(member.user._id)}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-mint">
                <Text className="font-extra text-xs text-teal">
                  {member.user.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-sm text-ink">
                  {member.user.name}
                </Text>
                <Text className="mt-1 font-medium text-[10px] text-muted">
                  {member.employmentType === "INTERN" ? "Intern" : "Employee"} ·{" "}
                  {member.activeTasks} active tasks
                </Text>
              </View>
              {busyId === member.user._id ? (
                <ActivityIndicator color={colors.teal} />
              ) : (
                <Ionicons
                  color={colors.muted}
                  name="chevron-forward"
                  size={18}
                />
              )}
            </Pressable>
          ))}
          {!members.length ? (
            <EmptyState
              icon="people-outline"
              title="No eligible assignees"
              description="Assign Sales Executives to your reporting team first."
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CreateTaskModal({
  dashboard,
  open,
  onClose,
  onCreated,
}: {
  dashboard: SalesDashboard;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const members = dashboard.team.filter((member) => member.assignable);
  const [form, setForm] = useState<CreateSalesTaskInput>({
    title: "",
    description: "",
    assignedToIds: [],
    priority: "MEDIUM",
    deadline: "",
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CreateSalesTaskInput>(
    key: K,
    value: CreateSalesTaskInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    const deadline = new Date(form.deadline);
    if (
      form.title.trim().length < 2 ||
      form.description.trim().length < 2 ||
      !form.assignedToIds.length ||
      Number.isNaN(deadline.getTime()) ||
      deadline <= new Date()
    ) {
      Alert.alert(
        "Assign Sales work",
        "Complete all fields and enter a future deadline, for example 2026-06-30 17:30.",
      );
      return;
    }
    setBusy(true);
    try {
      await salesService.createTask({
        ...form,
        deadline: deadline.toISOString(),
      });
      setForm({
        title: "",
        description: "",
        assignedToIds: [],
        priority: "MEDIUM",
        deadline: "",
      });
      await onCreated();
      Alert.alert(
        "Work assigned",
        form.assignedToIds.length > 1
          ? "The shared task and project chat are now available to the selected team."
          : "The task is now visible in the assignee’s Sales workspace.",
      );
    } catch (error) {
      Alert.alert(
        "Assign Sales work",
        getApiErrorMessage(error, "Unable to assign this task."),
      );
    } finally {
      setBusy(false);
    }
  };
  const assigneeType =
    dashboard.designation === "SALES_HEAD"
      ? "Sales Manager"
      : "Sales Executive";
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={open}
    >
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-3 px-5 pb-12 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-extra text-2xl text-ink">
              Assign Sales Work
            </Text>
            <Text className="mt-1 font-sans text-xs text-muted">
              Create a tracked task for a direct report.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-card border border-line bg-white"
            onPress={onClose}
          >
            <Ionicons color={colors.ink} name="close" size={20} />
          </Pressable>
        </View>
        <FormInput
          label="Task title *"
          value={form.title}
          onChangeText={(value) => set("title", value)}
        />
        <FormInput
          label="Description *"
          multiline
          value={form.description}
          onChangeText={(value) => set("description", value)}
        />
        <FormInput
          label="Deadline *"
          autoCapitalize="none"
          placeholder="YYYY-MM-DD HH:mm"
          value={form.deadline}
          onChangeText={(value) => set("deadline", value)}
        />
        <Text className="mt-2 font-bold text-xs text-ink">Priority</Text>
        <View className="flex-row flex-wrap gap-2">
          {taskPriorities.map((priority) => (
            <Choice
              key={priority}
              active={form.priority === priority}
              label={priority}
              onPress={() => set("priority", priority)}
            />
          ))}
        </View>
        <Text className="mt-2 font-bold text-xs text-ink">
          Assign to {assigneeType} *
        </Text>
        {members.map((member) => (
          <Pressable
            key={member.user._id}
            className={`flex-row items-center gap-3 rounded-card border p-4 ${form.assignedToIds.includes(member.user._id) ? "border-[#0D3FA3] bg-blue-50" : "border-line bg-white"}`}
            onPress={() => set("assignedToIds", form.assignedToIds.includes(member.user._id) ? form.assignedToIds.filter((userId) => userId !== member.user._id) : [...form.assignedToIds, member.user._id])}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-mint">
              <Text className="font-extra text-xs text-teal">
                {member.user.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-ink">
                {member.user.name}
              </Text>
              <Text className="mt-1 font-medium text-[10px] text-muted">
                {member.designation === "SALES_MANAGER"
                  ? "Sales Manager"
                  : member.employmentType === "INTERN"
                    ? "Sales Executive · Intern"
                    : "Sales Executive · Employee"}{" "}
                · {member.activeTasks} active
              </Text>
            </View>
            <Ionicons
              color={
                form.assignedToIds.includes(member.user._id) ? "#0D3FA3" : colors.muted
              }
              name={
                form.assignedToIds.includes(member.user._id)
                  ? "checkbox"
                  : "square-outline"
              }
              size={20}
            />
          </Pressable>
        ))}
        {!members.length ? (
          <EmptyState
            icon="people-outline"
            title={`No eligible ${assigneeType}s`}
            description={`Add a direct-reporting ${assigneeType} to your Sales hierarchy first.`}
          />
        ) : null}
        <Pressable
          disabled={busy || !members.length || !form.assignedToIds.length}
          className="mt-3 h-13 items-center justify-center rounded-card bg-[#0D3FA3] disabled:opacity-50"
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text className="font-bold text-sm text-white">Assign to {form.assignedToIds.length || "Selected"}</Text>
          )}
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

function FormInput({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text className="mb-2 font-bold text-xs text-ink">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        className={`rounded-card border border-line bg-white px-4 font-medium text-sm text-ink ${multiline ? "min-h-24 py-3" : "h-13"}`}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}
function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`rounded-full border px-3 py-2 ${active ? "border-[#0D3FA3] bg-blue-50" : "border-line bg-white"}`}
      onPress={onPress}
    >
      <Text
        className={`font-bold text-[10px] ${active ? "text-[#0D3FA3]" : "text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
