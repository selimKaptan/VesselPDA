CREATE TABLE "agency_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"tariff_no" varchar,
	"service_type" varchar,
	"nt_min" integer,
	"nt_max" integer,
	"fee" real,
	"per_1000_nt" real,
	"currency" varchar DEFAULT 'EUR',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"voyage_id" integer,
	"invoice_id" integer,
	"commission_type" text DEFAULT 'percentage' NOT NULL,
	"rate" real,
	"fixed_amount" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"base_amount" real,
	"calculated_amount" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_reviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_profile_id" integer NOT NULL,
	"reviewer_user_id" varchar NOT NULL,
	"tender_id" integer,
	"rating" integer NOT NULL,
	"comment" text,
	"vessel_name" text,
	"port_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"file_name" varchar(300),
	"file_type" varchar(50),
	"detected_event" varchar(50),
	"confidence" real,
	"summary" text,
	"full_analysis" jsonb,
	"action_taken" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "berthing_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"gt_min" integer,
	"gt_max" integer,
	"intl_foreign_flag" real,
	"intl_turkish_flag" real,
	"cabotage_turkish" real,
	"per_1000_gt" real,
	"gt_threshold" integer DEFAULT 500,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "broker_commissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "broker_commissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"fixture_id" integer,
	"commission_ref" varchar(100),
	"deal_description" varchar(500),
	"counterparty" varchar(300),
	"cargo_type" varchar(200),
	"voyage_description" varchar(300),
	"fixture_date" timestamp,
	"freight_amount" real,
	"freight_currency" varchar(10) DEFAULT 'USD',
	"commission_rate" real NOT NULL,
	"gross_commission" real NOT NULL,
	"deductions" real DEFAULT 0,
	"net_commission" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"payment_due_date" timestamp,
	"payment_received_date" timestamp,
	"status" varchar(30) DEFAULT 'pending',
	"invoice_number" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "broker_contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"contact_type" varchar(50) NOT NULL,
	"company_name" varchar(300) NOT NULL,
	"contact_name" varchar(200),
	"email" varchar(300),
	"phone" varchar(100),
	"mobile" varchar(100),
	"country" varchar(100),
	"city" varchar(200),
	"address" text,
	"website" varchar(300),
	"vessel_types" varchar(500),
	"trade_routes" text,
	"past_deal_count" integer DEFAULT 0,
	"last_deal_date" timestamp,
	"rating" integer,
	"is_favorite" boolean DEFAULT false,
	"tags" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bunker_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"voyage_id" integer,
	"user_id" varchar NOT NULL,
	"port" varchar(200),
	"order_date" timestamp,
	"delivery_date" timestamp,
	"fuel_type" varchar(50) NOT NULL,
	"quantity_ordered" real NOT NULL,
	"quantity_delivered" real,
	"price_per_mt" real,
	"currency" varchar(10) DEFAULT 'USD',
	"total_cost" real,
	"supplier" varchar(200),
	"bdn_number" varchar(100),
	"sulphur_content" real,
	"status" varchar(30) DEFAULT 'ordered',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bunker_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_name" text NOT NULL,
	"port_code" text,
	"region" text DEFAULT 'TR' NOT NULL,
	"ifo380" real,
	"vlsfo" real,
	"mgo" real,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "bunker_robs" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"voyage_id" integer,
	"report_date" timestamp NOT NULL,
	"hfo_rob" real DEFAULT 0,
	"mgo_rob" real DEFAULT 0,
	"lsfo_rob" real DEFAULT 0,
	"vlsfo_rob" real DEFAULT 0,
	"hfo_consumed" real DEFAULT 0,
	"mgo_consumed" real DEFAULT 0,
	"lsfo_consumed" real DEFAULT 0,
	"vlsfo_consumed" real DEFAULT 0,
	"reported_by" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cargo_handling_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"cargo_type" varchar,
	"operation" varchar,
	"rate" real,
	"unit" varchar,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cargo_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"port_call_id" integer,
	"voyage_id" integer,
	"vessel_id" integer,
	"cargo_name" text NOT NULL,
	"cargo_type" text DEFAULT 'bulk' NOT NULL,
	"operation" text DEFAULT 'loading' NOT NULL,
	"quantity" real,
	"unit" text DEFAULT 'MT' NOT NULL,
	"bl_number" text,
	"hatch_no" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cargo_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cargo_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"order_ref" varchar(100),
	"cargo_type" varchar(200) NOT NULL,
	"quantity" real,
	"quantity_unit" varchar(20) DEFAULT 'MT',
	"load_port" varchar(300),
	"discharge_port" varchar(300),
	"laycan_from" timestamp,
	"laycan_to" timestamp,
	"freight_idea" real,
	"freight_currency" varchar(10) DEFAULT 'USD',
	"freight_basis" varchar(50),
	"charterer" varchar(300),
	"charterer_contact" varchar(200),
	"vessel_type_required" varchar(200),
	"dwt_min" real,
	"dwt_max" real,
	"status" varchar(30) DEFAULT 'open',
	"matched_fixture_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cargo_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"position_type" text DEFAULT 'cargo' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"vessel_type" text,
	"cargo_type" text,
	"quantity" real,
	"quantity_unit" text,
	"loading_port" text NOT NULL,
	"discharge_port" text NOT NULL,
	"laycan_from" timestamp,
	"laycan_to" timestamp,
	"contact_name" text,
	"contact_email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chamber_freight_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"cargo_min" integer,
	"cargo_max" integer,
	"fee" real,
	"flag_category" varchar DEFAULT 'foreign',
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chamber_of_shipping_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_type" varchar,
	"vessel_category" varchar,
	"gt_min" integer,
	"gt_max" integer,
	"fee" real,
	"flag_category" varchar,
	"currency" varchar,
	"valid_year" integer,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "charter_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"charter_type" text NOT NULL,
	"charterer_name" text NOT NULL,
	"charterer_address" text,
	"cp_date" timestamp,
	"commencement_date" timestamp,
	"redelivery_date" timestamp,
	"hire_rate" real,
	"hire_currency" text DEFAULT 'USD',
	"hire_frequency" text DEFAULT 'semi_monthly',
	"trading_area" text,
	"cargo_description" text,
	"cp_terms" text,
	"status" text DEFAULT 'active' NOT NULL,
	"total_hire_earned" real DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cii_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cii_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"reporting_year" integer NOT NULL,
	"ship_type" varchar(100),
	"dwt" real,
	"total_co2_mt" real DEFAULT 0 NOT NULL,
	"distance_nm" real DEFAULT 0 NOT NULL,
	"cii_attained" real,
	"cii_required" real,
	"cii_rating" varchar(5),
	"hfo_consumed" real DEFAULT 0,
	"mgo_consumed" real DEFAULT 0,
	"lsfo_consumed" real DEFAULT 0,
	"vlsfo_consumed" real DEFAULT 0,
	"lng_consumed" real DEFAULT 0,
	"correction_factors" text,
	"status" varchar(20) DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"voyage_id" integer,
	"service_request_id" integer,
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"external_email" text,
	"external_email_name" text,
	"external_email_forward" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "crew_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"husbandry_order_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"seafarer_name" text NOT NULL,
	"rank" text,
	"nationality" text,
	"passport_number" text,
	"passport_issue_date" timestamp,
	"passport_expiry" timestamp,
	"seaman_book_number" text,
	"seaman_book_issue_date" timestamp,
	"seaman_book_expiry" timestamp,
	"date_of_birth" timestamp,
	"birth_place" text,
	"departure_date" timestamp,
	"arrival_date" timestamp,
	"visa_required" boolean DEFAULT false,
	"visa_status" text,
	"flight_details" text,
	"hotel_required" boolean DEFAULT false,
	"hotel_name" text,
	"port" text,
	"change_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_doc_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"port_name" text,
	"customs_authority" text,
	"customs_unit" text,
	"police_authority" text,
	"agent_personnel" jsonb,
	"agent_vehicles" jsonb,
	"ekim_tur_personnel" jsonb,
	"ekim_tur_vehicles" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_payroll" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"basic_salary" real NOT NULL,
	"overtime_hours" real DEFAULT 0,
	"overtime_rate" real DEFAULT 0,
	"bonus" real DEFAULT 0,
	"deductions" real DEFAULT 0,
	"net_pay" real NOT NULL,
	"currency" text DEFAULT 'USD',
	"paid_date" timestamp,
	"status" text DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crew_stcw_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"crew_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"cert_name" text NOT NULL,
	"cert_number" text,
	"issuing_authority" text,
	"issue_date" timestamp,
	"expiry_date" timestamp NOT NULL,
	"cert_type" text DEFAULT 'stcw',
	"status" text DEFAULT 'valid',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_tariff_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"port_id" integer,
	"service_name" varchar,
	"fee" real,
	"unit" varchar,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "custom_tariff_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar NOT NULL,
	"default_currency" varchar DEFAULT 'USD',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "da_advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"voyage_id" integer,
	"proforma_id" integer,
	"title" text NOT NULL,
	"requested_amount" real NOT NULL,
	"received_amount" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"recipient_email" text,
	"principal_name" text,
	"notes" text,
	"bank_details" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dcs_reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dcs_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"reporting_year" integer NOT NULL,
	"hfo_consumed" real DEFAULT 0,
	"lfo_consumed" real DEFAULT 0,
	"mdo_consumed" real DEFAULT 0,
	"lng_consumed" real DEFAULT 0,
	"total_fuel" real,
	"distance_nm" real,
	"hours_underway" real,
	"transport_work" real,
	"verifier" varchar(200),
	"verification_date" timestamp,
	"submission_date" timestamp,
	"status" varchar(20) DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_nominations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "direct_nominations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nominator_user_id" varchar NOT NULL,
	"agent_user_id" varchar NOT NULL,
	"agent_company_id" integer,
	"port_id" integer NOT NULL,
	"vessel_name" text NOT NULL,
	"vessel_id" integer,
	"purpose_of_call" text NOT NULL,
	"eta" timestamp,
	"etd" timestamp,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"content" text NOT NULL,
	"is_built_in" boolean DEFAULT true NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drydock_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drydock_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"job_number" varchar(50),
	"description" text NOT NULL,
	"category" varchar(100),
	"estimated_cost" real,
	"actual_cost" real,
	"planned_days" real,
	"priority" varchar(20) DEFAULT 'normal',
	"status" varchar(30) DEFAULT 'pending',
	"contractor" varchar(200),
	"start_date" timestamp,
	"completion_date" timestamp,
	"approved_by" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drydock_projects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drydock_projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"project_name" varchar(300) NOT NULL,
	"dock_type" varchar(50) DEFAULT 'special_survey',
	"shipyard" varchar(300),
	"shipyard_location" varchar(200),
	"planned_start" timestamp,
	"planned_end" timestamp,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"planned_budget" real,
	"currency" varchar(10) DEFAULT 'USD',
	"actual_cost" real DEFAULT 0,
	"superintendent" varchar(200),
	"class_surveyor" varchar(200),
	"status" varchar(30) DEFAULT 'planned',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "endorsements" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_company_profile_id" integer NOT NULL,
	"relationship" varchar(100) NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eu_ets_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "eu_ets_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"reporting_year" integer NOT NULL,
	"reporting_period" varchar(20),
	"voyage_type" varchar(50),
	"co2_emissions" real DEFAULT 0 NOT NULL,
	"ets_percentage" real DEFAULT 100,
	"ets_liable_co2" real,
	"allowances_purchased" real DEFAULT 0,
	"allowances_surrendered" real DEFAULT 0,
	"ets_price_eur" real,
	"total_cost_eur" real,
	"status" varchar(20) DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_currency" text NOT NULL,
	"target_currency" text NOT NULL,
	"buy_rate" real,
	"sell_rate" real,
	"effective_rate" real NOT NULL,
	"source" text DEFAULT 'tcmb' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_pilotage_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_description" text,
	"grt_up_to_1000" real,
	"per_additional_1000_grt" real,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fda_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"proforma_id" integer,
	"voyage_id" integer,
	"vessel_id" integer,
	"port_id" integer,
	"reference_number" varchar(50),
	"vessel_name" varchar(200),
	"port_name" varchar(200),
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"total_estimated_usd" real DEFAULT 0,
	"total_actual_usd" real DEFAULT 0,
	"total_estimated_eur" real DEFAULT 0,
	"total_actual_eur" real DEFAULT 0,
	"variance_usd" real DEFAULT 0,
	"variance_percent" real DEFAULT 0,
	"exchange_rate" real,
	"status" varchar(20) DEFAULT 'draft',
	"notes" text,
	"bank_details" jsonb,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fda_mapping_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedbacks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"page_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'negotiating' NOT NULL,
	"vessel_name" text NOT NULL,
	"imo_number" text,
	"cargo_type" text NOT NULL,
	"cargo_quantity" real,
	"quantity_unit" text DEFAULT 'MT' NOT NULL,
	"loading_port" text NOT NULL,
	"discharge_port" text NOT NULL,
	"laycan_from" timestamp,
	"laycan_to" timestamp,
	"freight_rate" real,
	"freight_currency" text DEFAULT 'USD' NOT NULL,
	"charterer" text,
	"shipowner" text,
	"broker_commission" real,
	"notes" text,
	"recap_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fleet_vessels" (
	"fleet_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fleet_vessels_fleet_id_vessel_id_pk" PRIMARY KEY("fleet_id","vessel_id")
);
--> statement-breakpoint
CREATE TABLE "fleets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"description" text,
	"topic_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "forum_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "forum_dislikes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_dislikes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"topic_id" integer,
	"reply_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_likes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_likes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"topic_id" integer,
	"reply_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"topic_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "harbour_master_dues" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_type" varchar,
	"vessel_category" varchar,
	"grt_min" integer,
	"grt_max" integer,
	"fee" real,
	"currency" varchar DEFAULT 'TRY',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hire_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"charter_party_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"period_from" timestamp NOT NULL,
	"period_to" timestamp NOT NULL,
	"hire_days" real NOT NULL,
	"gross_hire" real NOT NULL,
	"off_hire_deduction" real DEFAULT 0,
	"address_commission" real DEFAULT 0,
	"broker_commission" real DEFAULT 0,
	"net_hire" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" timestamp,
	"paid_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "husbandry_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "husbandry_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"voyage_id" integer,
	"port_call_id" integer,
	"user_id" varchar NOT NULL,
	"service_type" text NOT NULL,
	"description" text NOT NULL,
	"requested_date" timestamp,
	"completed_date" timestamp,
	"vendor" text,
	"cost" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"invoice_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insurance_claims" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "insurance_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"policy_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"incident_date" timestamp NOT NULL,
	"incident_type" varchar(100),
	"incident_location" varchar(300),
	"description" text NOT NULL,
	"estimated_claim" real,
	"actual_settlement" real,
	"deductible_applied" real,
	"currency" varchar(10) DEFAULT 'USD',
	"status" varchar(30) DEFAULT 'reported',
	"surveyor" varchar(200),
	"surveyor_contact" varchar(200),
	"correspondent" varchar(200),
	"correspondent_contact" varchar(200),
	"notes" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "insurance_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"policy_type" varchar(30) NOT NULL,
	"insurer" varchar(300) NOT NULL,
	"policy_number" varchar(200),
	"club" varchar(200),
	"insured_value" real,
	"currency" varchar(10) DEFAULT 'USD',
	"premium_amount" real,
	"premium_frequency" varchar(20),
	"deductible" real DEFAULT 0,
	"coverage_from" timestamp NOT NULL,
	"coverage_to" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"renewal_reminder_days" integer DEFAULT 30,
	"coverage_description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"payment_method" text,
	"reference" text,
	"notes" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer,
	"proforma_id" integer,
	"fda_id" integer,
	"created_by_user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"invoice_type" text DEFAULT 'invoice' NOT NULL,
	"linked_proforma_id" integer,
	"recipient_email" varchar,
	"recipient_name" varchar,
	"reminder_sent_at" timestamp,
	"overdue_reminder_sent_at" timestamp,
	"amount_paid" real DEFAULT 0,
	"balance" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "laytime_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"fixture_id" integer NOT NULL,
	"port_call_type" text DEFAULT 'loading' NOT NULL,
	"port_name" text,
	"allowed_laytime_hours" real DEFAULT 0 NOT NULL,
	"nor_started_at" timestamp,
	"berthing_at" timestamp,
	"loading_started_at" timestamp,
	"loading_completed_at" timestamp,
	"departed_at" timestamp,
	"time_used_hours" real DEFAULT 0,
	"demurrage_rate" real DEFAULT 0,
	"despatch_rate" real DEFAULT 0,
	"demurrage_amount" real DEFAULT 0,
	"despatch_amount" real DEFAULT 0,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deductions" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "laytime_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"voyage_id" integer,
	"title" text DEFAULT 'Laytime Calculation' NOT NULL,
	"vessel_name" text,
	"port_name" text,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lcb_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"nrt_min" integer,
	"nrt_max" integer,
	"amount" real,
	"currency" varchar DEFAULT 'TRY',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "light_dues" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_type" varchar,
	"vessel_category" varchar,
	"gt_min" integer,
	"gt_max" integer,
	"fee" real,
	"currency" varchar,
	"valid_year" integer,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"service_desc" varchar,
	"rate_up_to_800" real,
	"rate_above_800" real
);
--> statement-breakpoint
CREATE TABLE "maintenance_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"job_name" varchar(300) NOT NULL,
	"job_description" text,
	"interval_type" varchar(50) DEFAULT 'days',
	"interval_value" integer,
	"last_done_date" timestamp,
	"last_done_running_hours" real,
	"next_due_date" timestamp,
	"priority" varchar(20) DEFAULT 'routine',
	"status" varchar(30) DEFAULT 'pending',
	"assigned_to" varchar(200),
	"estimated_hours" real,
	"actual_hours" real,
	"parts_used" text,
	"completed_at" timestamp,
	"completion_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marpol_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"grt_min" integer,
	"grt_max" integer,
	"marpol_ek1_included" real,
	"marpol_ek4_included" real,
	"marpol_ek5_included" real,
	"fixed_fee" real,
	"weekday_ek1_rate" real,
	"weekday_ek4_rate" real,
	"weekday_ek5_rate" real,
	"weekend_ek1_rate" real,
	"weekend_ek4_rate" real,
	"weekend_ek5_rate" real,
	"currency" varchar DEFAULT 'EUR',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"message_type" text DEFAULT 'text' NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_size" integer,
	"read_at" timestamp,
	"mentions" text
);
--> statement-breakpoint
CREATE TABLE "misc_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"expense_type" text NOT NULL,
	"fee_usd" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "noon_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"voyage_id" integer,
	"user_id" varchar NOT NULL,
	"report_date" timestamp NOT NULL,
	"report_time" varchar(10) DEFAULT '12:00',
	"latitude" real,
	"longitude" real,
	"position_description" varchar(500),
	"speed_over_ground" real,
	"speed_through_water" real,
	"rpm" integer,
	"distance_last_noon" real,
	"distance_to_go" real,
	"eta" timestamp,
	"sea_state" integer,
	"wind_force" integer,
	"wind_direction" varchar(10),
	"swell_height" real,
	"hfo_consumed" real DEFAULT 0,
	"mgo_consumed" real DEFAULT 0,
	"lsfo_consumed" real DEFAULT 0,
	"hfo_rob" real,
	"mgo_rob" real,
	"lsfo_rob" real,
	"main_engine_hours" real,
	"aux_engine_hours" real,
	"remarks" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notice_of_readiness" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notice_of_readiness_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer,
	"vessel_id" integer,
	"port_id" integer,
	"port_call_id" integer,
	"user_id" varchar NOT NULL,
	"vessel_name" varchar(200),
	"port_name" varchar(200),
	"master_name" varchar(200),
	"agent_name" varchar(200),
	"charterer_name" varchar(200),
	"cargo_type" varchar(200),
	"cargo_quantity" varchar(100),
	"operation" varchar(50),
	"anchorage_arrival" timestamp,
	"berth_arrival" timestamp,
	"nor_tendered_at" timestamp,
	"nor_tendered_to" varchar(300),
	"nor_accepted_at" timestamp,
	"nor_accepted_by" varchar(200),
	"laytime_starts_at" timestamp,
	"ready_to" jsonb,
	"conditions" jsonb,
	"berth_name" varchar(200),
	"remarks" text,
	"status" varchar(20) DEFAULT 'draft',
	"rejection_reason" text,
	"signature_master" text,
	"signature_agent" text,
	"signature_charterer" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"email_on_proforma_approval" boolean DEFAULT true,
	"email_on_fda_ready" boolean DEFAULT true,
	"email_on_invoice_created" boolean DEFAULT true,
	"email_on_da_advance" boolean DEFAULT true,
	"email_on_cert_expiry" boolean DEFAULT true,
	"email_on_new_message" boolean DEFAULT true,
	"email_on_voyage_update" boolean DEFAULT false,
	"email_on_invoice_due" boolean DEFAULT true,
	"email_on_certificate_expiry" boolean DEFAULT true,
	"email_on_da_advance_due" boolean DEFAULT true,
	"email_on_payment_received" boolean DEFAULT true,
	"in_app_on_all" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "off_hire_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"charter_party_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"start_datetime" timestamp NOT NULL,
	"end_datetime" timestamp,
	"reason" text NOT NULL,
	"description" text,
	"deducted_days" real,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"display_name" text,
	"department" text,
	"job_title" text,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"invited_by" varchar,
	"joined_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"role_id" integer
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"type" text DEFAULT 'other',
	"owner_id" varchar NOT NULL,
	"logo_url" text,
	"website" text,
	"phone" text,
	"email" text,
	"address" text,
	"country" text,
	"tax_id" text,
	"subscription_plan" text DEFAULT 'free',
	"max_members" integer DEFAULT 5,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "other_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_name" varchar,
	"fee" real,
	"unit" varchar,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "passage_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"vessel_id" integer,
	"voyage_id" integer,
	"plan_name" varchar(255) NOT NULL,
	"origin" varchar(255) NOT NULL,
	"destination" varchar(255) NOT NULL,
	"total_distance_nm" real,
	"total_days" real,
	"departure_date" timestamp,
	"arrival_date" timestamp,
	"status" varchar(50) DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "passage_waypoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"waypoint_name" varchar(255) NOT NULL,
	"latitude" real,
	"longitude" real,
	"course_to_next" real,
	"distance_to_next_nm" real,
	"speed_knots" real,
	"etd" timestamp,
	"eta" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pilotage_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_type" varchar,
	"vessel_category" varchar,
	"grt_min" integer,
	"grt_max" integer,
	"base_fee" real,
	"per_1000_grt" real,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "port_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"port_name" text NOT NULL,
	"alert_type" text DEFAULT 'other' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_authority_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_type" varchar,
	"vessel_category" varchar,
	"grt_min" integer,
	"grt_max" integer,
	"amount" real,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp,
	"fee_name" varchar,
	"fee_no" varchar,
	"min" real,
	"max" real,
	"size_min" real,
	"size_max" real,
	"unit" varchar,
	"multiplier_rule" text
);
--> statement-breakpoint
CREATE TABLE "port_call_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"appointment_type" text DEFAULT 'other' NOT NULL,
	"scheduled_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"confirmed_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_call_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_call_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"category" text DEFAULT 'arrival' NOT NULL,
	"item" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_call_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_call_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(300),
	"role" varchar(50) NOT NULL,
	"company" varchar(200),
	"phone" varchar(50),
	"notes" text,
	"invite_status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "port_calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"port_name" text NOT NULL,
	"berth" text,
	"agent_name" text,
	"eta" timestamp,
	"actual_arrival" timestamp,
	"nor_tendered" timestamp,
	"berthing_time" timestamp,
	"operations_start" timestamp,
	"operations_end" timestamp,
	"departure" timestamp,
	"cargo_type" text,
	"cargo_quantity" real,
	"cargo_unit" text DEFAULT 'MT',
	"status" text DEFAULT 'expected' NOT NULL,
	"pilot_arranged" boolean DEFAULT false,
	"tug_arranged" boolean DEFAULT false,
	"customs_cleared" boolean DEFAULT false,
	"pda_issued" boolean DEFAULT false,
	"fda_issued" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"voyage_id" integer,
	"fda_id" integer,
	"port_call_id" integer,
	"category" text NOT NULL,
	"description" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"amount_usd" real,
	"receipt_number" text,
	"vendor" text,
	"expense_date" timestamp,
	"is_paid" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "port_tenders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "port_tenders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"port_id" integer NOT NULL,
	"vessel_name" text,
	"description" text,
	"cargo_info" text,
	"grt" real,
	"nrt" real,
	"flag" text,
	"cargo_type" text,
	"cargo_quantity" text,
	"previous_port" text,
	"q88_base64" text,
	"expiry_hours" integer DEFAULT 24 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"nominated_agent_id" varchar,
	"nominated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"country" text NOT NULL,
	"code" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"latitude" real,
	"longitude" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proforma_approval_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proforma_approval_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proforma_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proformas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proformas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"company_profile_id" integer,
	"vessel_id" integer NOT NULL,
	"port_id" integer NOT NULL,
	"reference_number" text NOT NULL,
	"to_company" text,
	"to_country" text,
	"purpose_of_call" text DEFAULT 'Loading' NOT NULL,
	"cargo_type" text,
	"cargo_quantity" real,
	"cargo_unit" text DEFAULT 'MT',
	"berth_stay_days" integer DEFAULT 5 NOT NULL,
	"exchange_rate" real DEFAULT 1,
	"line_items" jsonb NOT NULL,
	"total_usd" real NOT NULL,
	"total_eur" real,
	"notes" text,
	"bank_details" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"revision_note" text,
	"approval_note" text,
	"approval_token" varchar,
	"recipient_email" varchar,
	"voyage_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "psc_deficiencies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "psc_deficiencies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"inspection_id" integer NOT NULL,
	"vessel_id" integer NOT NULL,
	"deficiency_code" varchar(50),
	"description" text NOT NULL,
	"action_required" text,
	"rectification_deadline" timestamp,
	"rectified_date" timestamp,
	"status" varchar(20) DEFAULT 'open',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "psc_inspections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "psc_inspections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"inspection_date" timestamp NOT NULL,
	"port" varchar(300) NOT NULL,
	"psc_authority" varchar(200),
	"inspector_name" varchar(200),
	"result" varchar(20) DEFAULT 'pass',
	"deficiency_count" integer DEFAULT 0,
	"detention" boolean DEFAULT false,
	"detention_reason" text,
	"released_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sanctions_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"vessel_name" text,
	"imo_number" text,
	"mmsi" text,
	"entity_name" text,
	"check_type" text DEFAULT 'entity' NOT NULL,
	"result" text NOT NULL,
	"match_details" jsonb,
	"source" text DEFAULT 'ofac' NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanitary_dues" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"nrt_rate" real,
	"currency" varchar DEFAULT 'TRY',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_offers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_offers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"service_request_id" integer NOT NULL,
	"provider_user_id" varchar NOT NULL,
	"provider_company_id" integer,
	"price" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"estimated_duration" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"requester_id" varchar NOT NULL,
	"port_id" integer NOT NULL,
	"voyage_id" integer,
	"vessel_name" text NOT NULL,
	"grt" real,
	"service_type" text DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"quantity" real,
	"unit" text,
	"preferred_date" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sof_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sof_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_name" varchar(300) NOT NULL,
	"event_date" timestamp NOT NULL,
	"remarks" text,
	"is_deductible" boolean DEFAULT false,
	"deductible_hours" real DEFAULT 0,
	"laytime_factor" integer DEFAULT 100,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spare_part_requisition_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spare_part_requisition_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"requisition_id" integer NOT NULL,
	"spare_part_id" integer,
	"description" varchar(500) NOT NULL,
	"quantity_requested" integer NOT NULL,
	"quantity_received" integer DEFAULT 0,
	"unit_price" real,
	"total_price" real,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spare_part_requisitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spare_part_requisitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"requisition_number" varchar(100),
	"requested_date" timestamp NOT NULL,
	"required_by" timestamp,
	"priority" varchar(20) DEFAULT 'normal',
	"status" varchar(30) DEFAULT 'pending',
	"approved_by" varchar(200),
	"supplier" varchar(200),
	"order_number" varchar(200),
	"total_cost" real,
	"currency" varchar(10) DEFAULT 'USD',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spare_parts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"part_number" varchar(200),
	"drawing_number" varchar(200),
	"description" varchar(500) NOT NULL,
	"maker" varchar(200),
	"maker_ref" varchar(200),
	"equipment_id" integer,
	"location_onboard" varchar(200),
	"unit_of_measure" varchar(50) DEFAULT 'piece',
	"quantity_onboard" integer DEFAULT 0,
	"minimum_stock" integer DEFAULT 1,
	"quantity_ordered" integer DEFAULT 0,
	"unit_price" real,
	"currency" varchar(10) DEFAULT 'USD',
	"last_updated" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "statement_of_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer,
	"vessel_id" integer,
	"port_id" integer,
	"port_call_id" integer,
	"user_id" varchar NOT NULL,
	"vessel_name" varchar(200),
	"port_name" varchar(200),
	"berth_name" varchar(200),
	"cargo_type" varchar(200),
	"cargo_quantity" varchar(100),
	"operation" varchar(50),
	"master_name" varchar(200),
	"agent_name" varchar(200),
	"status" varchar(20) DEFAULT 'draft',
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"finalized_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supervision_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"category" varchar,
	"cargo_type" varchar,
	"quantity_range" varchar,
	"rate" real,
	"unit" varchar,
	"currency" varchar DEFAULT 'EUR',
	"notes" text,
	"valid_year" integer DEFAULT 2026,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tariff_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tariff_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"port_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"calculation_type" text DEFAULT 'fixed' NOT NULL,
	"base_unit" text,
	"overtime_rate" real,
	"currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariff_rates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tariff_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"min_grt" real DEFAULT 0 NOT NULL,
	"max_grt" real,
	"rate" real NOT NULL,
	"per_unit" text
);
--> statement-breakpoint
CREATE TABLE "tender_bids" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tender_bids_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tender_id" integer NOT NULL,
	"agent_user_id" varchar NOT NULL,
	"agent_company_id" integer,
	"proforma_pdf_base64" text,
	"proforma_pdf_url" text,
	"notes" text,
	"total_amount" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tonnage_tariffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"nrt_min" integer,
	"nrt_max" integer,
	"ithalat" real,
	"ihracat" real,
	"currency" varchar DEFAULT 'TRY',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vessel_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"vessel_id" integer NOT NULL,
	"name" text NOT NULL,
	"cert_type" text DEFAULT 'other' NOT NULL,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"issuing_authority" text,
	"certificate_number" text,
	"notes" text,
	"status" text DEFAULT 'valid' NOT NULL,
	"renewal_status" text DEFAULT 'none' NOT NULL,
	"renewal_planned_date" timestamp,
	"file_base64" text,
	"file_name" text,
	"file_url" text,
	"file_size" integer,
	"created_at" timestamp DEFAULT now(),
	"category" text DEFAULT 'statutory' NOT NULL,
	"vault_doc_type" text,
	"reminder_sent_days" text
);
--> statement-breakpoint
CREATE TABLE "vessel_crew" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"rank" text,
	"nationality" text,
	"contract_start_date" timestamp,
	"contract_end_date" timestamp,
	"monthly_salary" real,
	"salary_currency" text DEFAULT 'USD',
	"seaman_book_number" text,
	"seaman_book_expiry" timestamp,
	"passport_number" text,
	"passport_expiry" timestamp,
	"visa_type" text,
	"visa_expiry" timestamp,
	"next_port_join" text,
	"relief_due_date" timestamp,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"passport_file_base64" text,
	"passport_file_name" text,
	"passport_file_url" text,
	"seamans_book_file_base64" text,
	"seamans_book_file_name" text,
	"seamans_book_file_url" text,
	"medical_fitness_expiry" timestamp,
	"medical_fitness_file_base64" text,
	"medical_fitness_file_name" text,
	"medical_fitness_file_url" text,
	"status" text DEFAULT 'on_board',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_defects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vessel_defects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"defect_number" varchar(50),
	"title" varchar(300) NOT NULL,
	"description" text,
	"location" varchar(200),
	"defect_type" varchar(50) DEFAULT 'defect',
	"reported_date" timestamp NOT NULL,
	"priority" varchar(20) DEFAULT 'routine',
	"status" varchar(30) DEFAULT 'open',
	"assigned_to" varchar(200),
	"target_close_date" timestamp,
	"actual_close_date" timestamp,
	"root_cause" text,
	"corrective_action" text,
	"maintenance_job_id" integer,
	"estimated_cost" real,
	"actual_cost" real,
	"reported_by" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"equipment_type" varchar(100),
	"manufacturer" varchar(200),
	"model" varchar(200),
	"serial_number" varchar(100),
	"install_date" timestamp,
	"location" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_openings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vessel_openings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"opening_ref" varchar(100),
	"vessel_id" integer,
	"vessel_name" varchar(200) NOT NULL,
	"vessel_type" varchar(100),
	"dwt" real,
	"built_year" integer,
	"flag" varchar(100),
	"owner" varchar(300),
	"owner_contact" varchar(200),
	"open_date" timestamp,
	"open_port" varchar(300),
	"open_area" varchar(200),
	"hire_idea" real,
	"hire_currency" varchar(10) DEFAULT 'USD',
	"hire_basis" varchar(50),
	"status" varchar(30) DEFAULT 'open',
	"matched_fixture_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_item_id" integer,
	"mmsi" text NOT NULL,
	"imo" text,
	"vessel_name" text,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"speed" real,
	"course" real,
	"heading" real,
	"navigation_status" text,
	"destination" text,
	"eta" timestamp,
	"draught" real,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_q88" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vessel_q88_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vessel_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"vessel_name" varchar(200),
	"ex_name" varchar(200),
	"flag" varchar(100),
	"port_of_registry" varchar(200),
	"imo_number" varchar(20),
	"call_sign" varchar(20),
	"mmsi_number" varchar(20),
	"vessel_type" varchar(100),
	"year_built" integer,
	"builder" varchar(200),
	"classification_society" varchar(200),
	"class_notation" varchar(200),
	"pi_club" varchar(200),
	"hull_material" varchar(50) DEFAULT 'Steel',
	"grt" real,
	"nrt" real,
	"dwt" real,
	"displacement" real,
	"loa" real,
	"lbp" real,
	"beam" real,
	"depth" real,
	"max_draft" real,
	"summer_draft" real,
	"tpc" real,
	"light_ship_weight" real,
	"grain_capacity" real,
	"bale_capacity" real,
	"number_of_holds" integer,
	"number_of_hatches" integer,
	"hold_dimensions" jsonb DEFAULT '[]'::jsonb,
	"hatch_type" varchar(100),
	"hatch_covers" varchar(200),
	"number_of_cranes" integer,
	"crane_capacity" varchar(200),
	"number_of_derricks" integer,
	"derrick_capacity" varchar(200),
	"grabs_available" boolean DEFAULT false,
	"grab_capacity" varchar(100),
	"cargo_gear_details" text,
	"main_engine" varchar(200),
	"engine_power" varchar(100),
	"service_speed" real,
	"max_speed" real,
	"fuel_type" varchar(100),
	"fuel_consumption" varchar(200),
	"auxiliary_engines" varchar(200),
	"bow_thruster" boolean DEFAULT false,
	"bow_thruster_power" varchar(100),
	"heavy_fuel_capacity" real,
	"diesel_oil_capacity" real,
	"fresh_water_capacity" real,
	"ballast_capacity" real,
	"communication_equipment" jsonb DEFAULT '[]'::jsonb,
	"navigation_equipment" jsonb DEFAULT '[]'::jsonb,
	"lifeboats" varchar(200),
	"life_rafts" varchar(200),
	"fire_extinguishing" varchar(300),
	"crew_capacity" integer,
	"officer_cabins" integer,
	"crew_cabins" integer,
	"certificates_on_board" jsonb DEFAULT '[]'::jsonb,
	"special_equipment" text,
	"ice_class" varchar(50),
	"fitted_for_heavy_lifts" boolean DEFAULT false,
	"co2_fitted" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now(),
	"is_public" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"status" varchar(20) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessel_watchlist" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vessel_watchlist_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"mmsi" text,
	"imo" text,
	"vessel_name" text NOT NULL,
	"flag" text,
	"vessel_type" text,
	"notes" text,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vessels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vessels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"company_profile_id" integer,
	"name" text NOT NULL,
	"flag" text NOT NULL,
	"vessel_type" text NOT NULL,
	"grt" real NOT NULL,
	"nrt" real NOT NULL,
	"dwt" real,
	"loa" real,
	"beam" real,
	"imo_number" text,
	"mmsi" text,
	"call_sign" text,
	"year_built" integer,
	"fleet_status" text DEFAULT 'idle',
	"datalastic_uuid" text,
	"engine_power" real,
	"engine_type" text,
	"classification_society" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyage_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer NOT NULL,
	"user_id" varchar,
	"activity_type" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_cargo_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"log_date" timestamp,
	"shift" text DEFAULT 'morning',
	"from_time" timestamp,
	"to_time" timestamp,
	"receiver_id" integer,
	"amount_handled" real NOT NULL,
	"truck_count" integer,
	"batch_id" varchar,
	"cumulative_total" real,
	"log_type" text DEFAULT 'operation',
	"remarks" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_cargo_receivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"name" text NOT NULL,
	"allocated_mt" real NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_checklists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyage_checklists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer NOT NULL,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"assigned_to" text DEFAULT 'both' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_collaborators" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"organization_id" integer,
	"user_id" varchar,
	"invited_by_user_id" varchar NOT NULL,
	"invitee_email" varchar(300),
	"invitee_company_id" integer,
	"role" text DEFAULT 'observer' NOT NULL,
	"service_type" varchar(100),
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" varchar(100),
	"expires_at" timestamp,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"decline_reason" text,
	"message" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "voyage_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" varchar(20) DEFAULT 'other' NOT NULL,
	"include_in_daily_reports" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_crew_logistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" varchar(200) NOT NULL,
	"rank" varchar(100) NOT NULL,
	"side" varchar(10) DEFAULT 'on' NOT NULL,
	"nationality" varchar(10) DEFAULT '',
	"passport_no" varchar(50) DEFAULT '',
	"flight" varchar(20) DEFAULT '',
	"flight_eta" varchar(10) DEFAULT '',
	"flight_delayed" boolean DEFAULT false NOT NULL,
	"visa_required" boolean DEFAULT false NOT NULL,
	"e_visa_status" varchar(20) DEFAULT 'n/a' NOT NULL,
	"ok_to_board" varchar(20) DEFAULT 'pending' NOT NULL,
	"arrival_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"docs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requires_hotel" boolean DEFAULT false NOT NULL,
	"hotel_name" varchar(200) DEFAULT '',
	"hotel_check_in" varchar(10) DEFAULT '',
	"hotel_check_out" varchar(10) DEFAULT '',
	"hotel_status" varchar(20) DEFAULT 'none' NOT NULL,
	"hotel_pickup_time" varchar(10) DEFAULT '',
	"dob" varchar(20) DEFAULT '',
	"seaman_book_no" varchar(50) DEFAULT '',
	"birth_place" varchar(100) DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyage_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer NOT NULL,
	"name" text NOT NULL,
	"doc_type" text DEFAULT 'other' NOT NULL,
	"file_base64" text,
	"file_url" text,
	"file_name" text,
	"file_size" integer,
	"notes" text,
	"uploaded_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"version" integer DEFAULT 1,
	"signature_text" text,
	"signed_at" timestamp,
	"template_id" integer,
	"parent_doc_id" integer
);
--> statement-breakpoint
CREATE TABLE "voyage_estimations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyage_estimations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"vessel_id" integer,
	"estimation_name" varchar(300) NOT NULL,
	"vessel_name" varchar(200),
	"vessel_type" varchar(100),
	"dwt" real,
	"speed_laden" real DEFAULT 12,
	"speed_ballast" real DEFAULT 13,
	"consumption_laden" real DEFAULT 28,
	"consumption_ballast" real DEFAULT 25,
	"consumption_port" real DEFAULT 3,
	"fuel_type" varchar(50) DEFAULT 'VLSFO',
	"fuel_price" real DEFAULT 600,
	"cargo_type" varchar(200),
	"cargo_quantity" real,
	"freight_rate" real,
	"freight_currency" varchar(10) DEFAULT 'USD',
	"freight_basis" varchar(50) DEFAULT 'PWWD',
	"load_port" varchar(300),
	"discharge_port" varchar(300),
	"distance_laden" real,
	"distance_ballast" real,
	"port_days_load" real DEFAULT 2,
	"port_days_discharge" real DEFAULT 2,
	"port_cost_load" real DEFAULT 0,
	"port_cost_discharge" real DEFAULT 0,
	"canal_cost" real DEFAULT 0,
	"misc_costs" real DEFAULT 0,
	"address_commission" real DEFAULT 0,
	"broker_commission_pct" real DEFAULT 0,
	"gross_freight" real,
	"total_voyage_costs" real,
	"net_profit" real,
	"voyage_days" real,
	"tce" real,
	"breakeven_freight" real,
	"status" varchar(20) DEFAULT 'draft',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"voyage_id" integer NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"note_type" text DEFAULT 'comment' NOT NULL,
	"is_private" boolean DEFAULT false,
	"linked_entity_type" text,
	"linked_entity_id" integer,
	"mentions" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyage_reviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyage_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"voyage_id" integer NOT NULL,
	"reviewer_user_id" varchar NOT NULL,
	"reviewee_user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voyages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "voyages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"vessel_id" integer,
	"port_id" integer NOT NULL,
	"agent_user_id" varchar,
	"tender_id" integer,
	"vessel_name" text,
	"imo_number" text,
	"flag" text,
	"vessel_type" text,
	"grt" real,
	"mmsi" text,
	"call_sign" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"eta" timestamp,
	"etd" timestamp,
	"purpose_of_call" text DEFAULT 'Loading' NOT NULL,
	"notes" text,
	"cargo_type" text,
	"cargo_quantity" real,
	"cargo_total_mt" real,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vts_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"port_id" integer,
	"service_name" varchar,
	"fee" real,
	"unit" varchar,
	"currency" varchar DEFAULT 'USD',
	"valid_year" integer DEFAULT 2026,
	"notes" text,
	"updated_at" timestamp,
	"nrt_min" integer,
	"nrt_max" integer,
	"flag_category" varchar
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_profile_id" integer NOT NULL,
	"email" varchar NOT NULL,
	"token" varchar NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "company_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_profile_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"invited_by_user_id" varchar,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"company_name" text NOT NULL,
	"company_type" varchar DEFAULT 'agent' NOT NULL,
	"description" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"city" text,
	"country" text DEFAULT 'Turkey',
	"served_ports" jsonb DEFAULT '[]'::jsonb,
	"service_types" jsonb DEFAULT '[]'::jsonb,
	"logo_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"verification_status" varchar DEFAULT 'unverified' NOT NULL,
	"tax_number" varchar(50),
	"mto_registration_number" varchar(100),
	"pandi_club_name" varchar(100),
	"verification_requested_at" timestamp,
	"verification_approved_at" timestamp,
	"verification_note" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_iban" text,
	"bank_swift" text,
	"bank_currency" varchar(10) DEFAULT 'USD',
	"bank_branch_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"user_role" varchar DEFAULT 'shipowner' NOT NULL,
	"active_role" varchar,
	"role_confirmed" boolean DEFAULT false NOT NULL,
	"subscription_plan" varchar DEFAULT 'free' NOT NULL,
	"proforma_count" integer DEFAULT 0 NOT NULL,
	"proforma_limit" integer DEFAULT 1 NOT NULL,
	"password_hash" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"verification_token_expiry" timestamp,
	"reset_password_token" text,
	"reset_password_token_expiry" timestamp,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"demo_seeded" boolean DEFAULT false NOT NULL,
	"is_demo_account" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agency_fees" ADD CONSTRAINT "agency_fees_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_tender_id_port_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."port_tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_history" ADD CONSTRAINT "ai_analysis_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berthing_tariffs" ADD CONSTRAINT "berthing_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_contacts" ADD CONSTRAINT "broker_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_orders" ADD CONSTRAINT "bunker_orders_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_orders" ADD CONSTRAINT "bunker_orders_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_orders" ADD CONSTRAINT "bunker_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_prices" ADD CONSTRAINT "bunker_prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_robs" ADD CONSTRAINT "bunker_robs_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_robs" ADD CONSTRAINT "bunker_robs_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunker_robs" ADD CONSTRAINT "bunker_robs_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_handling_tariffs" ADD CONSTRAINT "cargo_handling_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_operations" ADD CONSTRAINT "cargo_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_operations" ADD CONSTRAINT "cargo_operations_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_operations" ADD CONSTRAINT "cargo_operations_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_operations" ADD CONSTRAINT "cargo_operations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_orders" ADD CONSTRAINT "cargo_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_orders" ADD CONSTRAINT "cargo_orders_matched_fixture_id_fixtures_id_fk" FOREIGN KEY ("matched_fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargo_positions" ADD CONSTRAINT "cargo_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamber_freight_share" ADD CONSTRAINT "chamber_freight_share_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_parties" ADD CONSTRAINT "charter_parties_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charter_parties" ADD CONSTRAINT "charter_parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cii_records" ADD CONSTRAINT "cii_records_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cii_records" ADD CONSTRAINT "cii_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_changes" ADD CONSTRAINT "crew_changes_husbandry_order_id_husbandry_orders_id_fk" FOREIGN KEY ("husbandry_order_id") REFERENCES "public"."husbandry_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_changes" ADD CONSTRAINT "crew_changes_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_payroll" ADD CONSTRAINT "crew_payroll_crew_id_vessel_crew_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."vessel_crew"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_payroll" ADD CONSTRAINT "crew_payroll_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_payroll" ADD CONSTRAINT "crew_payroll_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_stcw_certificates" ADD CONSTRAINT "crew_stcw_certificates_crew_id_vessel_crew_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."vessel_crew"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_stcw_certificates" ADD CONSTRAINT "crew_stcw_certificates_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tariff_entries" ADD CONSTRAINT "custom_tariff_entries_section_id_custom_tariff_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."custom_tariff_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tariff_entries" ADD CONSTRAINT "custom_tariff_entries_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "da_advances" ADD CONSTRAINT "da_advances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "da_advances" ADD CONSTRAINT "da_advances_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "da_advances" ADD CONSTRAINT "da_advances_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dcs_reports" ADD CONSTRAINT "dcs_reports_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dcs_reports" ADD CONSTRAINT "dcs_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_nominations" ADD CONSTRAINT "direct_nominations_nominator_user_id_users_id_fk" FOREIGN KEY ("nominator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_nominations" ADD CONSTRAINT "direct_nominations_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_nominations" ADD CONSTRAINT "direct_nominations_agent_company_id_company_profiles_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_nominations" ADD CONSTRAINT "direct_nominations_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_nominations" ADD CONSTRAINT "direct_nominations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drydock_jobs" ADD CONSTRAINT "drydock_jobs_project_id_drydock_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."drydock_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drydock_jobs" ADD CONSTRAINT "drydock_jobs_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drydock_jobs" ADD CONSTRAINT "drydock_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drydock_projects" ADD CONSTRAINT "drydock_projects_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drydock_projects" ADD CONSTRAINT "drydock_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_to_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("to_company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eu_ets_records" ADD CONSTRAINT "eu_ets_records_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eu_ets_records" ADD CONSTRAINT "eu_ets_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_pilotage_tariffs" ADD CONSTRAINT "external_pilotage_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_accounts" ADD CONSTRAINT "fda_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_accounts" ADD CONSTRAINT "fda_accounts_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_accounts" ADD CONSTRAINT "fda_accounts_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_accounts" ADD CONSTRAINT "fda_accounts_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_accounts" ADD CONSTRAINT "fda_accounts_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fda_mapping_templates" ADD CONSTRAINT "fda_mapping_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_vessels" ADD CONSTRAINT "fleet_vessels_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_vessels" ADD CONSTRAINT "fleet_vessels_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_dislikes" ADD CONSTRAINT "forum_dislikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_dislikes" ADD CONSTRAINT "forum_dislikes_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_dislikes" ADD CONSTRAINT "forum_dislikes_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_category_id_forum_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harbour_master_dues" ADD CONSTRAINT "harbour_master_dues_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hire_payments" ADD CONSTRAINT "hire_payments_charter_party_id_charter_parties_id_fk" FOREIGN KEY ("charter_party_id") REFERENCES "public"."charter_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hire_payments" ADD CONSTRAINT "hire_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "husbandry_orders" ADD CONSTRAINT "husbandry_orders_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "husbandry_orders" ADD CONSTRAINT "husbandry_orders_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "husbandry_orders" ADD CONSTRAINT "husbandry_orders_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "husbandry_orders" ADD CONSTRAINT "husbandry_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "husbandry_orders" ADD CONSTRAINT "husbandry_orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_policy_id_insurance_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fda_id_fda_accounts_id_fk" FOREIGN KEY ("fda_id") REFERENCES "public"."fda_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laytime_calculations" ADD CONSTRAINT "laytime_calculations_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laytime_sheets" ADD CONSTRAINT "laytime_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laytime_sheets" ADD CONSTRAINT "laytime_sheets_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lcb_tariffs" ADD CONSTRAINT "lcb_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_equipment_id_vessel_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."vessel_equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marpol_tariffs" ADD CONSTRAINT "marpol_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misc_expenses" ADD CONSTRAINT "misc_expenses_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noon_reports" ADD CONSTRAINT "noon_reports_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noon_reports" ADD CONSTRAINT "noon_reports_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noon_reports" ADD CONSTRAINT "noon_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_of_readiness" ADD CONSTRAINT "notice_of_readiness_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_of_readiness" ADD CONSTRAINT "notice_of_readiness_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_of_readiness" ADD CONSTRAINT "notice_of_readiness_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_of_readiness" ADD CONSTRAINT "notice_of_readiness_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_of_readiness" ADD CONSTRAINT "notice_of_readiness_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "off_hire_events" ADD CONSTRAINT "off_hire_events_charter_party_id_charter_parties_id_fk" FOREIGN KEY ("charter_party_id") REFERENCES "public"."charter_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "off_hire_events" ADD CONSTRAINT "off_hire_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "other_services" ADD CONSTRAINT "other_services_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_waypoints" ADD CONSTRAINT "passage_waypoints_plan_id_passage_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."passage_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilotage_tariffs" ADD CONSTRAINT "pilotage_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_alerts" ADD CONSTRAINT "port_alerts_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_alerts" ADD CONSTRAINT "port_alerts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_authority_fees" ADD CONSTRAINT "port_authority_fees_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_call_appointments" ADD CONSTRAINT "port_call_appointments_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_call_appointments" ADD CONSTRAINT "port_call_appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_call_checklists" ADD CONSTRAINT "port_call_checklists_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_call_checklists" ADD CONSTRAINT "port_call_checklists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_call_participants" ADD CONSTRAINT "port_call_participants_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_calls" ADD CONSTRAINT "port_calls_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_calls" ADD CONSTRAINT "port_calls_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_calls" ADD CONSTRAINT "port_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_expenses" ADD CONSTRAINT "port_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_expenses" ADD CONSTRAINT "port_expenses_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_expenses" ADD CONSTRAINT "port_expenses_fda_id_fda_accounts_id_fk" FOREIGN KEY ("fda_id") REFERENCES "public"."fda_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_expenses" ADD CONSTRAINT "port_expenses_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_tenders" ADD CONSTRAINT "port_tenders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_tenders" ADD CONSTRAINT "port_tenders_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_approval_logs" ADD CONSTRAINT "proforma_approval_logs_proforma_id_proformas_id_fk" FOREIGN KEY ("proforma_id") REFERENCES "public"."proformas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_approval_logs" ADD CONSTRAINT "proforma_approval_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psc_deficiencies" ADD CONSTRAINT "psc_deficiencies_inspection_id_psc_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."psc_inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psc_deficiencies" ADD CONSTRAINT "psc_deficiencies_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psc_inspections" ADD CONSTRAINT "psc_inspections_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psc_inspections" ADD CONSTRAINT "psc_inspections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions_checks" ADD CONSTRAINT "sanctions_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanitary_dues" ADD CONSTRAINT "sanitary_dues_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offers" ADD CONSTRAINT "service_offers_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offers" ADD CONSTRAINT "service_offers_provider_user_id_users_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_offers" ADD CONSTRAINT "service_offers_provider_company_id_company_profiles_id_fk" FOREIGN KEY ("provider_company_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sof_line_items" ADD CONSTRAINT "sof_line_items_sof_id_statement_of_facts_id_fk" FOREIGN KEY ("sof_id") REFERENCES "public"."statement_of_facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_requisition_items" ADD CONSTRAINT "spare_part_requisition_items_requisition_id_spare_part_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."spare_part_requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_requisition_items" ADD CONSTRAINT "spare_part_requisition_items_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_requisitions" ADD CONSTRAINT "spare_part_requisitions_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_part_requisitions" ADD CONSTRAINT "spare_part_requisitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_equipment_id_vessel_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."vessel_equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_of_facts" ADD CONSTRAINT "statement_of_facts_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_of_facts" ADD CONSTRAINT "statement_of_facts_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_of_facts" ADD CONSTRAINT "statement_of_facts_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_of_facts" ADD CONSTRAINT "statement_of_facts_port_call_id_port_calls_id_fk" FOREIGN KEY ("port_call_id") REFERENCES "public"."port_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_of_facts" ADD CONSTRAINT "statement_of_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervision_fees" ADD CONSTRAINT "supervision_fees_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_categories" ADD CONSTRAINT "tariff_categories_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_rates" ADD CONSTRAINT "tariff_rates_category_id_tariff_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tariff_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_tender_id_port_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."port_tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_agent_company_id_company_profiles_id_fk" FOREIGN KEY ("agent_company_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tonnage_tariffs" ADD CONSTRAINT "tonnage_tariffs_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_certificates" ADD CONSTRAINT "vessel_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_certificates" ADD CONSTRAINT "vessel_certificates_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_crew" ADD CONSTRAINT "vessel_crew_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_crew" ADD CONSTRAINT "vessel_crew_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_defects" ADD CONSTRAINT "vessel_defects_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_defects" ADD CONSTRAINT "vessel_defects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_defects" ADD CONSTRAINT "vessel_defects_maintenance_job_id_maintenance_jobs_id_fk" FOREIGN KEY ("maintenance_job_id") REFERENCES "public"."maintenance_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_equipment" ADD CONSTRAINT "vessel_equipment_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_equipment" ADD CONSTRAINT "vessel_equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_openings" ADD CONSTRAINT "vessel_openings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_openings" ADD CONSTRAINT "vessel_openings_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_openings" ADD CONSTRAINT "vessel_openings_matched_fixture_id_fixtures_id_fk" FOREIGN KEY ("matched_fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_positions" ADD CONSTRAINT "vessel_positions_watchlist_item_id_vessel_watchlist_id_fk" FOREIGN KEY ("watchlist_item_id") REFERENCES "public"."vessel_watchlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_q88" ADD CONSTRAINT "vessel_q88_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_q88" ADD CONSTRAINT "vessel_q88_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_watchlist" ADD CONSTRAINT "vessel_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_activities" ADD CONSTRAINT "voyage_activities_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_activities" ADD CONSTRAINT "voyage_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_cargo_logs" ADD CONSTRAINT "voyage_cargo_logs_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_cargo_logs" ADD CONSTRAINT "voyage_cargo_logs_receiver_id_voyage_cargo_receivers_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."voyage_cargo_receivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_cargo_logs" ADD CONSTRAINT "voyage_cargo_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_cargo_receivers" ADD CONSTRAINT "voyage_cargo_receivers_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_chat_messages" ADD CONSTRAINT "voyage_chat_messages_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_chat_messages" ADD CONSTRAINT "voyage_chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_checklists" ADD CONSTRAINT "voyage_checklists_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_collaborators" ADD CONSTRAINT "voyage_collaborators_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_collaborators" ADD CONSTRAINT "voyage_collaborators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_collaborators" ADD CONSTRAINT "voyage_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_collaborators" ADD CONSTRAINT "voyage_collaborators_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_contacts" ADD CONSTRAINT "voyage_contacts_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_crew_logistics" ADD CONSTRAINT "voyage_crew_logistics_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_documents" ADD CONSTRAINT "voyage_documents_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_documents" ADD CONSTRAINT "voyage_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_estimations" ADD CONSTRAINT "voyage_estimations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_estimations" ADD CONSTRAINT "voyage_estimations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_notes" ADD CONSTRAINT "voyage_notes_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_notes" ADD CONSTRAINT "voyage_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_reviews" ADD CONSTRAINT "voyage_reviews_voyage_id_voyages_id_fk" FOREIGN KEY ("voyage_id") REFERENCES "public"."voyages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_reviews" ADD CONSTRAINT "voyage_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyage_reviews" ADD CONSTRAINT "voyage_reviews_reviewee_user_id_users_id_fk" FOREIGN KEY ("reviewee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages" ADD CONSTRAINT "voyages_tender_id_port_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."port_tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vts_fees" ADD CONSTRAINT "vts_fees_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_pair_source_idx" ON "exchange_rates" USING btree ("base_currency","target_currency","source");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "proformas_user_idx" ON "proformas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proformas_voyage_idx" ON "proformas" USING btree ("voyage_id");--> statement-breakpoint
CREATE INDEX "tender_bids_tender_idx" ON "tender_bids" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "vessel_positions_mmsi_timestamp_idx" ON "vessel_positions" USING btree ("mmsi","timestamp");--> statement-breakpoint
CREATE INDEX "voyages_user_idx" ON "voyages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voyages_agent_idx" ON "voyages" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");