import { relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/auth";
import { vessels } from "./vessel";
import { ports } from "./port";
import { portTenders } from "./tender";
import { organizations } from "./organization";

export const voyages = pgTable("voyages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").notNull().references(() => ports.id),
  agentUserId: varchar("agent_user_id").references(() => users.id),
  tenderId: integer("tender_id").references(() => portTenders.id),
  vesselName: text("vessel_name"),
  imoNumber: text("imo_number"),
  flag: text("flag"),
  vesselType: text("vessel_type"),
  grt: real("grt"),
  mmsi: text("mmsi"),
  callSign: text("call_sign"),
  status: text("status").notNull().default("planned"),
  eta: timestamp("eta"),
  etd: timestamp("etd"),
  purposeOfCall: text("purpose_of_call").notNull().default("Loading"),
  notes: text("notes"),
  cargoType: text("cargo_type"),
  cargoQuantity: real("cargo_quantity"),
  cargoTotalMt: real("cargo_total_mt"),
  originPortId: integer("origin_port_id").references(() => ports.id),
  originPortName: text("origin_port_name"),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  workflowSteps: jsonb("workflow_steps").default({}),
}, (table) => ({
  userIdx: index("voyages_user_idx").on(table.userId),
  agentIdx: index("voyages_agent_idx").on(table.agentUserId),
}));

export const voyageChecklists = pgTable("voyage_checklists", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  assignedTo: text("assigned_to").notNull().default("both"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageCargoReceivers = pgTable("voyage_cargo_receivers", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  allocatedMt: real("allocated_mt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageCargoLogs = pgTable("voyage_cargo_logs", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  logDate: timestamp("log_date"),
  shift: text("shift").default("morning"),
  fromTime: timestamp("from_time"),
  toTime: timestamp("to_time"),
  receiverId: integer("receiver_id").references(() => voyageCargoReceivers.id, { onDelete: "set null" }),
  amountHandled: real("amount_handled").notNull(),
  truckCount: integer("truck_count"),
  batchId: varchar("batch_id"),
  cumulativeTotal: real("cumulative_total"),
  logType: text("log_type").default("operation"),
  remarks: text("remarks"),
  vesselType: varchar("vessel_type", { length: 20 }).default("dry_bulk"),
  parcelId: integer("parcel_id"),
  holdNumber: varchar("hold_number", { length: 50 }),
  quantity: real("quantity"),
  unit: varchar("unit", { length: 10 }).default("MT"),
  craneUsed: varchar("crane_used", { length: 50 }),
  gangsWorking: integer("gangs_working"),
  tankNumber: varchar("tank_number", { length: 50 }),
  equipment: varchar("equipment", { length: 50 }),
  connectionsQty: integer("connections_qty"),
  pressure: real("pressure"),
  temperature: real("temperature"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cargoParcels = pgTable("cargo_parcels", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  receiverName: varchar("receiver_name", { length: 300 }).notNull(),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoDescription: varchar("cargo_description", { length: 500 }),
  targetQuantity: real("target_quantity").default(0),
  handledQuantity: real("handled_quantity").default(0),
  unit: varchar("unit", { length: 20 }).default("MT"),
  holdNumbers: varchar("hold_numbers", { length: 200 }),
  blNumber: varchar("bl_number", { length: 100 }),
  blDate: timestamp("bl_date"),
  status: varchar("status", { length: 20 }).default("pending"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stowagePlans = pgTable("stowage_plans", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  fileUrl: varchar("file_url", { length: 500 }),
  fileName: varchar("file_name", { length: 300 }),
  holdNotes: text("hold_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoParcelSchema = createInsertSchema(cargoParcels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStowagePlanSchema = createInsertSchema(stowagePlans).omit({ id: true, createdAt: true });
export type CargoParcel = typeof cargoParcels.$inferSelect;
export type StowagePlan = typeof stowagePlans.$inferSelect;

export const voyageActivities = pgTable("voyage_activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export interface VoyageParticipantPermissions {
  canViewDocuments?: boolean;
  canUploadDocuments?: boolean;
  canChat?: boolean;
  canViewFinancials?: boolean;
  canEditChecklist?: boolean;
  canViewSOF?: boolean;
}

export const DEFAULT_PARTICIPANT_PERMISSIONS: Record<string, VoyageParticipantPermissions> = {
  agent:    { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: true, canEditChecklist: true, canViewSOF: true },
  provider: { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: false, canEditChecklist: false, canViewSOF: false },
  surveyor: { canViewDocuments: true, canUploadDocuments: true, canChat: true, canViewFinancials: false, canEditChecklist: false, canViewSOF: true },
  broker:   { canViewDocuments: true, canUploadDocuments: false, canChat: true, canViewFinancials: true, canEditChecklist: false, canViewSOF: false },
  observer: { canViewDocuments: true, canUploadDocuments: false, canChat: false, canViewFinancials: false, canEditChecklist: false, canViewSOF: true },
};

export const voyageCollaborators = pgTable("voyage_collaborators", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inviteeEmail: varchar("invitee_email", { length: 300 }),
  inviteeCompanyId: integer("invitee_company_id"),
  role: text("role").notNull().default("observer"),
  serviceType: varchar("service_type", { length: 100 }),
  permissions: jsonb("permissions").$type<VoyageParticipantPermissions>().notNull().default({}),
  status: text("status").notNull().default("pending"),
  token: varchar("token", { length: 100 }),
  expiresAt: timestamp("expires_at"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  declineReason: text("decline_reason"),
  message: text("message"),
  notes: text("notes"),
});

export const voyageChatMessages = pgTable("voyage_chat_messages", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageDocuments = pgTable("voyage_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  docType: text("doc_type").notNull().default("other"),
  fileBase64: text("file_base64"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  notes: text("notes"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  version: integer("version").default(1),
  signatureText: text("signature_text"),
  signedAt: timestamp("signed_at"),
  templateId: integer("template_id"),
  parentDocId: integer("parent_doc_id"),
});

export const voyageReviews = pgTable("voyage_reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  reviewerUserId: varchar("reviewer_user_id").notNull().references(() => users.id),
  revieweeUserId: varchar("reviewee_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageNotes = pgTable("voyage_notes", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("comment"),
  isPrivate: boolean("is_private").default(false),
  linkedEntityType: text("linked_entity_type"),
  linkedEntityId: integer("linked_entity_id"),
  mentions: text("mentions").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voyageContacts = pgTable("voyage_contacts", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("other").notNull(),
  includeInDailyReports: boolean("include_in_daily_reports").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voyageCrewLogistics = pgTable("voyage_crew_logistics", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  rank: varchar("rank", { length: 100 }).notNull(),
  side: varchar("side", { length: 10 }).notNull().default("on"),
  nationality: varchar("nationality", { length: 10 }).default(""),
  passportNo: varchar("passport_no", { length: 50 }).default(""),
  flight: varchar("flight", { length: 20 }).default(""),
  flightEta: varchar("flight_eta", { length: 10 }).default(""),
  flightDelayed: boolean("flight_delayed").default(false).notNull(),
  visaRequired: boolean("visa_required").default(false).notNull(),
  eVisaStatus: varchar("e_visa_status", { length: 20 }).default("n/a").notNull(),
  okToBoard: varchar("ok_to_board", { length: 20 }).default("pending").notNull(),
  arrivalStatus: varchar("arrival_status", { length: 20 }).default("pending").notNull(),
  timeline: jsonb("timeline").default([]).notNull(),
  docs: jsonb("docs").default({}).notNull(),
  requiresHotel: boolean("requires_hotel").default(false).notNull(),
  hotelName: varchar("hotel_name", { length: 200 }).default(""),
  hotelCheckIn: varchar("hotel_check_in", { length: 10 }).default(""),
  hotelCheckOut: varchar("hotel_check_out", { length: 10 }).default(""),
  hotelStatus: varchar("hotel_status", { length: 20 }).default("none").notNull(),
  hotelPickupTime: varchar("hotel_pickup_time", { length: 10 }).default(""),
  dob: varchar("dob", { length: 20 }).default(""),
  seamanBookNo: varchar("seaman_book_no", { length: 50 }).default(""),
  birthPlace: varchar("birth_place", { length: 100 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const portCalls = pgTable("port_calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "set null" }),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  portName: text("port_name").notNull(),
  berth: text("berth"),
  agentName: text("agent_name"),
  eta: timestamp("eta"),
  actualArrival: timestamp("actual_arrival"),
  norTendered: timestamp("nor_tendered"),
  berthingTime: timestamp("berthing_time"),
  operationsStart: timestamp("operations_start"),
  operationsEnd: timestamp("operations_end"),
  departure: timestamp("departure"),
  cargoType: text("cargo_type"),
  cargoQuantity: real("cargo_quantity"),
  cargoUnit: text("cargo_unit").default("MT"),
  status: text("status").notNull().default("expected"),
  pilotArranged: boolean("pilot_arranged").default(false),
  tugArranged: boolean("tug_arranged").default(false),
  customsCleared: boolean("customs_cleared").default(false),
  pdaIssued: boolean("pda_issued").default(false),
  fdaIssued: boolean("fda_issued").default(false),
  notes: text("notes"),
  workflowStep: integer("workflow_step").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portCallParticipants = pgTable("port_call_participants", {
  id: serial("id").primaryKey(),
  portCallId: integer("port_call_id").notNull().references(() => portCalls.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 300 }),
  role: varchar("role", { length: 50 }).notNull(),
  company: varchar("company", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  inviteStatus: varchar("invite_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portCallAppointments = pgTable("port_call_appointments", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").notNull().references(() => voyages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  appointmentType: text("appointment_type").notNull().default("other"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  confirmedBy: text("confirmed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statementOfFacts = pgTable("statement_of_facts", {
  id: serial("id").primaryKey(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").references(() => ports.id),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselName: varchar("vessel_name", { length: 200 }),
  portName: varchar("port_name", { length: 200 }),
  berthName: varchar("berth_name", { length: 200 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: varchar("cargo_quantity", { length: 100 }),
  operation: varchar("operation", { length: 50 }),
  masterName: varchar("master_name", { length: 200 }),
  agentName: varchar("agent_name", { length: 200 }),
  status: varchar("status", { length: 20 }).default("draft"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
});

export const sofLineItems = pgTable("sof_line_items", {
  id: serial("id").primaryKey(),
  sofId: integer("sof_id").notNull().references(() => statementOfFacts.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventName: varchar("event_name", { length: 300 }).notNull(),
  eventDate: timestamp("event_date").notNull(),
  remarks: text("remarks"),
  isDeductible: boolean("is_deductible").default(false),
  deductibleHours: real("deductible_hours").default(0),
  laytimeFactor: integer("laytime_factor").default(100),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const noticeOfReadiness = pgTable("notice_of_readiness", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  voyageId: integer("voyage_id").references(() => voyages.id, { onDelete: "cascade" }),
  vesselId: integer("vessel_id").references(() => vessels.id),
  portId: integer("port_id").references(() => ports.id),
  portCallId: integer("port_call_id").references(() => portCalls.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  vesselName: varchar("vessel_name", { length: 200 }),
  portName: varchar("port_name", { length: 200 }),
  masterName: varchar("master_name", { length: 200 }),
  agentName: varchar("agent_name", { length: 200 }),
  chartererName: varchar("charterer_name", { length: 200 }),
  cargoType: varchar("cargo_type", { length: 200 }),
  cargoQuantity: varchar("cargo_quantity", { length: 100 }),
  operation: varchar("operation", { length: 50 }),
  anchorageArrival: timestamp("anchorage_arrival"),
  berthArrival: timestamp("berth_arrival"),
  norTenderedAt: timestamp("nor_tendered_at"),
  norTenderedTo: varchar("nor_tendered_to", { length: 300 }),
  norAcceptedAt: timestamp("nor_accepted_at"),
  norAcceptedBy: varchar("nor_accepted_by", { length: 200 }),
  laytimeStartsAt: timestamp("laytime_starts_at"),
  readyTo: jsonb("ready_to").$type<string[]>(),
  conditions: jsonb("conditions").$type<string[]>(),
  berthName: varchar("berth_name", { length: 200 }),
  remarks: text("remarks"),
  status: varchar("status", { length: 20 }).default("draft"),
  rejectionReason: text("rejection_reason"),
  signatureMaster: text("signature_master"),
  signatureAgent: text("signature_agent"),
  signatureCharterer: text("signature_charterer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voyageRelations = relations(voyages, ({ one, many }) => ({
  user: one(users, { fields: [voyages.userId], references: [users.id] }),
  vessel: one(vessels, { fields: [voyages.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [voyages.portId], references: [ports.id] }),
  tender: one(portTenders, { fields: [voyages.tenderId], references: [portTenders.id] }),
  checklists: many(voyageChecklists),
  activities: many(voyageActivities),
}));

export const portCallRelations = relations(portCalls, ({ one }) => ({
  voyage: one(voyages, { fields: [portCalls.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [portCalls.vesselId], references: [vessels.id] }),
  user: one(users, { fields: [portCalls.userId], references: [users.id] }),
}));

export const portCallParticipantRelations = relations(portCallParticipants, ({ one }) => ({
  portCall: one(portCalls, { fields: [portCallParticipants.portCallId], references: [portCalls.id] }),
}));

export const voyageChecklistRelations = relations(voyageChecklists, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageChecklists.voyageId], references: [voyages.id] }),
}));

export const voyageCargoReceiverRelations = relations(voyageCargoReceivers, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCargoReceivers.voyageId], references: [voyages.id] }),
}));

export const voyageCargoLogRelations = relations(voyageCargoLogs, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCargoLogs.voyageId], references: [voyages.id] }),
  receiver: one(voyageCargoReceivers, { fields: [voyageCargoLogs.receiverId], references: [voyageCargoReceivers.id] }),
}));

export const voyageCollaboratorRelations = relations(voyageCollaborators, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageCollaborators.voyageId], references: [voyages.id] }),
  invitedByUser: one(users, { fields: [voyageCollaborators.invitedByUserId], references: [users.id] }),
  user: one(users, { fields: [voyageCollaborators.userId], references: [users.id] }),
}));

export const voyageChatMessageRelations = relations(voyageChatMessages, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageChatMessages.voyageId], references: [voyages.id] }),
  sender: one(users, { fields: [voyageChatMessages.senderId], references: [users.id] }),
}));

export const voyageDocumentRelations = relations(voyageDocuments, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageDocuments.voyageId], references: [voyages.id] }),
  uploader: one(users, { fields: [voyageDocuments.uploadedByUserId], references: [users.id] }),
}));

export const voyageReviewRelations = relations(voyageReviews, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageReviews.voyageId], references: [voyages.id] }),
  reviewer: one(users, { fields: [voyageReviews.reviewerUserId], references: [users.id] }),
  reviewee: one(users, { fields: [voyageReviews.revieweeUserId], references: [users.id] }),
}));

export const voyageNoteRelations = relations(voyageNotes, ({ one }) => ({
  voyage: one(voyages, { fields: [voyageNotes.voyageId], references: [voyages.id] }),
  author: one(users, { fields: [voyageNotes.authorId], references: [users.id] }),
}));

export const portCallAppointmentRelations = relations(portCallAppointments, ({ one }) => ({
  voyage: one(voyages, { fields: [portCallAppointments.voyageId], references: [voyages.id] }),
  user: one(users, { fields: [portCallAppointments.userId], references: [users.id] }),
}));

export const sofRelations = relations(statementOfFacts, ({ one, many }) => ({
  voyage: one(voyages, { fields: [statementOfFacts.voyageId], references: [voyages.id] }),
  vessel: one(vessels, { fields: [statementOfFacts.vesselId], references: [vessels.id] }),
  port: one(ports, { fields: [statementOfFacts.portId], references: [ports.id] }),
  user: one(users, { fields: [statementOfFacts.userId], references: [users.id] }),
  events: many(sofLineItems),
}));

export const sofLineItemRelations = relations(sofLineItems, ({ one }) => ({
  sof: one(statementOfFacts, { fields: [sofLineItems.sofId], references: [statementOfFacts.id] }),
}));

export const insertVoyageSchema = createInsertSchema(voyages).omit({ createdAt: true });
export const insertVoyageChecklistSchema = createInsertSchema(voyageChecklists).omit({ createdAt: true, isCompleted: true, completedAt: true });
export const insertVoyageDocumentSchema = createInsertSchema(voyageDocuments).omit({ createdAt: true });
export const insertVoyageReviewSchema = createInsertSchema(voyageReviews).omit({ createdAt: true });
export const insertVoyageChatMessageSchema = createInsertSchema(voyageChatMessages).omit({ createdAt: true });
export const insertVoyageCargoReceiverSchema = createInsertSchema(voyageCargoReceivers).omit({ id: true, createdAt: true });
export const insertVoyageCargoLogSchema = createInsertSchema(voyageCargoLogs).omit({ id: true, createdAt: true });
export const insertVoyageNoteSchema = createInsertSchema(voyageNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVoyageContactSchema = createInsertSchema(voyageContacts).omit({ id: true, createdAt: true });
export const insertVoyageCrewLogisticSchema = createInsertSchema(voyageCrewLogistics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPortCallSchema = createInsertSchema(portCalls).omit({ id: true, createdAt: true });
export const insertPortCallParticipantSchema = createInsertSchema(portCallParticipants).omit({ id: true, createdAt: true });
export const insertPortCallAppointmentSchema = createInsertSchema(portCallAppointments).omit({ createdAt: true });
export const insertSofSchema = createInsertSchema(statementOfFacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSofLineItemSchema = createInsertSchema(sofLineItems).omit({ id: true, createdAt: true });

export const insertVoyageActivitySchema = z.object({
  voyageId: z.number().int(),
  userId: z.string().optional().nullable(),
  activityType: z.string().max(50),
  title: z.string().max(300),
  description: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const insertVoyageCollaboratorSchema = z.object({
  voyageId: z.number().int(),
  userId: z.string().optional(),
  inviteeEmail: z.string().email().optional(),
  inviteeCompanyId: z.number().int().optional(),
  role: z.string().default("observer"),
  serviceType: z.string().optional(),
  message: z.string().optional(),
});

export const insertNorSchema = z.object({
  voyageId: z.number().int().optional().nullable(),
  vesselId: z.number().int().optional().nullable(),
  portId: z.number().int().optional().nullable(),
  portCallId: z.number().int().optional().nullable(),
  userId: z.string(),
  vesselName: z.string().max(200).optional().nullable(),
  portName: z.string().max(200).optional().nullable(),
  masterName: z.string().max(200).optional().nullable(),
  agentName: z.string().max(200).optional().nullable(),
  chartererName: z.string().max(200).optional().nullable(),
  cargoType: z.string().max(200).optional().nullable(),
  cargoQuantity: z.string().max(100).optional().nullable(),
  operation: z.string().max(50).optional().nullable(),
  anchorageArrival: z.coerce.date().optional().nullable(),
  berthArrival: z.coerce.date().optional().nullable(),
  norTenderedAt: z.coerce.date().optional().nullable(),
  norTenderedTo: z.string().max(300).optional().nullable(),
  norAcceptedAt: z.coerce.date().optional().nullable(),
  norAcceptedBy: z.string().max(200).optional().nullable(),
  laytimeStartsAt: z.coerce.date().optional().nullable(),
  readyTo: z.array(z.string()).optional().nullable(),
  conditions: z.array(z.string()).optional().nullable(),
  berthName: z.string().max(200).optional().nullable(),
  remarks: z.string().optional().nullable(),
  status: z.string().max(20).optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  signatureMaster: z.string().optional().nullable(),
  signatureAgent: z.string().optional().nullable(),
  signatureCharterer: z.string().optional().nullable(),
});

export type InsertVoyage = z.infer<typeof insertVoyageSchema>;
export type Voyage = typeof voyages.$inferSelect;
export type InsertVoyageChecklist = z.infer<typeof insertVoyageChecklistSchema>;
export type VoyageChecklist = typeof voyageChecklists.$inferSelect;
export type InsertVoyageDocument = z.infer<typeof insertVoyageDocumentSchema>;
export type VoyageDocument = typeof voyageDocuments.$inferSelect;
export type InsertVoyageReview = z.infer<typeof insertVoyageReviewSchema>;
export type VoyageReview = typeof voyageReviews.$inferSelect;
export type InsertVoyageChatMessage = z.infer<typeof insertVoyageChatMessageSchema>;
export type VoyageChatMessage = typeof voyageChatMessages.$inferSelect;
export type InsertVoyageActivity = z.infer<typeof insertVoyageActivitySchema>;
export type VoyageActivity = typeof voyageActivities.$inferSelect;
export type VoyageCollaborator = typeof voyageCollaborators.$inferSelect;
export type InsertVoyageCargoReceiver = z.infer<typeof insertVoyageCargoReceiverSchema>;
export type VoyageCargoReceiver = typeof voyageCargoReceivers.$inferSelect;
export type InsertVoyageCargoLog = z.infer<typeof insertVoyageCargoLogSchema>;
export type VoyageCargoLog = typeof voyageCargoLogs.$inferSelect;
export type InsertVoyageNote = z.infer<typeof insertVoyageNoteSchema>;
export type VoyageNote = typeof voyageNotes.$inferSelect;
export type InsertVoyageContact = z.infer<typeof insertVoyageContactSchema>;
export type VoyageContact = typeof voyageContacts.$inferSelect;
export type InsertVoyageCrewLogistic = z.infer<typeof insertVoyageCrewLogisticSchema>;
export type VoyageCrewLogistic = typeof voyageCrewLogistics.$inferSelect;
export type InsertPortCall = z.infer<typeof insertPortCallSchema>;
export type PortCall = typeof portCalls.$inferSelect;
export type InsertPortCallParticipant = z.infer<typeof insertPortCallParticipantSchema>;
export type PortCallParticipant = typeof portCallParticipants.$inferSelect;
export type InsertPortCallAppointment = z.infer<typeof insertPortCallAppointmentSchema>;
export type PortCallAppointment = typeof portCallAppointments.$inferSelect;
export type InsertSof = z.infer<typeof insertSofSchema>;
export type InsertSofLineItem = z.infer<typeof insertSofLineItemSchema>;
export type Sof = typeof statementOfFacts.$inferSelect;
export type SofLineItem = typeof sofLineItems.$inferSelect;
export type InsertNor = z.infer<typeof insertNorSchema>;
export type Nor = typeof noticeOfReadiness.$inferSelect;
