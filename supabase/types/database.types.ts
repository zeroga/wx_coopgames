export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ammo_guidance_modes: {
        Row: {
          ammo_id: string
          lock_time_seconds: number | null
          mode_code: string
          note: string | null
          source_type: string | null
          source_url: string | null
          verification_status: string
        }
        Insert: {
          ammo_id: string
          lock_time_seconds?: number | null
          mode_code: string
          note?: string | null
          source_type?: string | null
          source_url?: string | null
          verification_status?: string
        }
        Update: {
          ammo_id?: string
          lock_time_seconds?: number | null
          mode_code?: string
          note?: string | null
          source_type?: string | null
          source_url?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ammo_guidance_modes_ammo_id_fkey"
            columns: ["ammo_id"]
            isOneToOne: false
            referencedRelation: "vehicle_ammo"
            referencedColumns: ["id"]
          },
        ]
      }
      ammo_penetration_samples: {
        Row: {
          ammo_id: string
          condition_note: string | null
          distance_m: number | null
          id: string
          impact_angle_deg: number | null
          penetration_mm: number
          sample_key: string
          source_type: string | null
          source_url: string | null
          verification_status: string
        }
        Insert: {
          ammo_id: string
          condition_note?: string | null
          distance_m?: number | null
          id?: string
          impact_angle_deg?: number | null
          penetration_mm: number
          sample_key: string
          source_type?: string | null
          source_url?: string | null
          verification_status?: string
        }
        Update: {
          ammo_id?: string
          condition_note?: string | null
          distance_m?: number | null
          id?: string
          impact_angle_deg?: number | null
          penetration_mm?: number
          sample_key?: string
          source_type?: string | null
          source_url?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ammo_penetration_samples_ammo_id_fkey"
            columns: ["ammo_id"]
            isOneToOne: false
            referencedRelation: "vehicle_ammo"
            referencedColumns: ["id"]
          },
        ]
      }
      ammo_trait_links: {
        Row: {
          ammo_id: string
          source_type: string | null
          source_url: string | null
          trait_code: string
          verification_status: string
        }
        Insert: {
          ammo_id: string
          source_type?: string | null
          source_url?: string | null
          trait_code: string
          verification_status?: string
        }
        Update: {
          ammo_id?: string
          source_type?: string | null
          source_url?: string | null
          trait_code?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ammo_trait_links_ammo_id_fkey"
            columns: ["ammo_id"]
            isOneToOne: false
            referencedRelation: "vehicle_ammo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ammo_trait_links_trait_code_fkey"
            columns: ["trait_code"]
            isOneToOne: false
            referencedRelation: "ammo_traits"
            referencedColumns: ["code"]
          },
        ]
      }
      ammo_traits: {
        Row: {
          category: string
          code: string
          description: string | null
          name_zh: string
        }
        Insert: {
          category: string
          code: string
          description?: string | null
          name_zh: string
        }
        Update: {
          category?: string
          code?: string
          description?: string | null
          name_zh?: string
        }
        Relationships: []
      }
      ammo_upgrade_links: {
        Row: {
          ammo_id: string
          upgrade_id: string
          vehicle_id: string
          weapon_id: string
        }
        Insert: {
          ammo_id: string
          upgrade_id: string
          vehicle_id: string
          weapon_id: string
        }
        Update: {
          ammo_id?: string
          upgrade_id?: string
          vehicle_id?: string
          weapon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ammo_upgrade_links_ammo_id_weapon_id_fkey"
            columns: ["ammo_id", "weapon_id"]
            isOneToOne: false
            referencedRelation: "vehicle_ammo"
            referencedColumns: ["id", "weapon_id"]
          },
          {
            foreignKeyName: "ammo_upgrade_links_upgrade_id_vehicle_id_fkey"
            columns: ["upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "ammo_upgrade_links_weapon_id_vehicle_id_fkey"
            columns: ["weapon_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_weapons"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
      capabilities: {
        Row: {
          category: string
          code: string
          description: string | null
          name_zh: string
          parent_code: string | null
        }
        Insert: {
          category: string
          code: string
          description?: string | null
          name_zh: string
          parent_code?: string | null
        }
        Update: {
          category?: string
          code?: string
          description?: string | null
          name_zh?: string
          parent_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["code"]
          },
        ]
      }
      dealers: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          source_url: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
          source_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          source_url?: string | null
        }
        Relationships: []
      }
      era_coverage: {
        Row: {
          capability_id: string
          location: string
          note: string | null
        }
        Insert: {
          capability_id: string
          location: string
          note?: string | null
        }
        Update: {
          capability_id?: string
          location?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "era_coverage_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "vehicle_era"
            referencedColumns: ["capability_id"]
          },
        ]
      }
      tech_tree_branches: {
        Row: {
          dealer_id: string | null
          id: string
          name: string
          slug: string
          source_url: string | null
          verification_status: string
        }
        Insert: {
          dealer_id?: string | null
          id?: string
          name: string
          slug: string
          source_url?: string | null
          verification_status?: string
        }
        Update: {
          dealer_id?: string | null
          id?: string
          name?: string
          slug?: string
          source_url?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_tree_branches_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          code: string
          dealer_id: string | null
          id: string
          name: string
          source_type: string | null
          source_url: string | null
          tier: number | null
        }
        Insert: {
          code: string
          dealer_id?: string | null
          id?: string
          name: string
          source_type?: string | null
          source_url?: string | null
          tier?: number | null
        }
        Update: {
          code?: string
          dealer_id?: string | null
          id?: string
          name?: string
          source_type?: string | null
          source_url?: string | null
          tier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_paths: {
        Row: {
          id: string
          is_complete: boolean
          name: string
          note: string | null
          slug: string
          sort_order: number
          target_upgrade_id: string | null
          vehicle_id: string
        }
        Insert: {
          id?: string
          is_complete?: boolean
          name: string
          note?: string | null
          slug: string
          sort_order?: number
          target_upgrade_id?: string | null
          vehicle_id: string
        }
        Update: {
          id?: string
          is_complete?: boolean
          name?: string
          note?: string | null
          slug?: string
          sort_order?: number
          target_upgrade_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_target_upgrade_same_vehicle"
            columns: ["target_upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
      unlock_requirements: {
        Row: {
          dealer_id: string | null
          description: string
          event_code: string | null
          id: string
          last_checked_at: string | null
          operator: string | null
          required_value: number | null
          requirement_type: string
          scope: Json
          slug: string
          sort_order: number
          source_note: string | null
          source_type: string | null
          source_upgrade_id: string | null
          source_url: string | null
          source_vehicle_id: string | null
          token_id: string | null
          unit: string | null
          unlock_path_id: string
          verification_status: string
        }
        Insert: {
          dealer_id?: string | null
          description: string
          event_code?: string | null
          id?: string
          last_checked_at?: string | null
          operator?: string | null
          required_value?: number | null
          requirement_type: string
          scope?: Json
          slug: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_upgrade_id?: string | null
          source_url?: string | null
          source_vehicle_id?: string | null
          token_id?: string | null
          unit?: string | null
          unlock_path_id: string
          verification_status?: string
        }
        Update: {
          dealer_id?: string | null
          description?: string
          event_code?: string | null
          id?: string
          last_checked_at?: string | null
          operator?: string | null
          required_value?: number | null
          requirement_type?: string
          scope?: Json
          slug?: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_upgrade_id?: string | null
          source_url?: string | null
          source_vehicle_id?: string | null
          token_id?: string | null
          unit?: string | null
          unlock_path_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_requirements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_unlock_path_id_fkey"
            columns: ["unlock_path_id"]
            isOneToOne: false
            referencedRelation: "aw_tech_tree_requirements"
            referencedColumns: ["unlock_path_id"]
          },
          {
            foreignKeyName: "unlock_requirements_unlock_path_id_fkey"
            columns: ["unlock_path_id"]
            isOneToOne: false
            referencedRelation: "aw_upgrade_unlock_requirements"
            referencedColumns: ["unlock_path_id"]
          },
          {
            foreignKeyName: "unlock_requirements_unlock_path_id_fkey"
            columns: ["unlock_path_id"]
            isOneToOne: false
            referencedRelation: "unlock_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_source_upgrade_same_vehicle"
            columns: ["source_upgrade_id", "source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
      upgrade_prerequisites: {
        Row: {
          prerequisite_upgrade_id: string
          upgrade_id: string
          vehicle_id: string
        }
        Insert: {
          prerequisite_upgrade_id: string
          upgrade_id: string
          vehicle_id: string
        }
        Update: {
          prerequisite_upgrade_id?: string
          upgrade_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_prerequisites_prerequisite_upgrade_id_vehicle_id_fkey"
            columns: ["prerequisite_upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "upgrade_prerequisites_upgrade_id_vehicle_id_fkey"
            columns: ["upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
      vehicle_ammo: {
        Row: {
          accuracy_deg: number | null
          ammo_subtype: string | null
          ammo_type: string
          created_at: string
          damage: number | null
          explosion_radius_m: number | null
          id: string
          intra_clip_reload: number | null
          is_guided: boolean | null
          is_missile: boolean | null
          last_checked_at: string | null
          magazine_mechanism: string | null
          magazine_size: number | null
          module_damage: number | null
          module_damage_bonus_pct: number | null
          name: string
          note: string | null
          penetration: number | null
          penetration_reference_m: number | null
          range: number | null
          rate_of_fire: number | null
          reload_seconds: number | null
          requires_research: boolean | null
          slug: string
          sort_order: number
          source_note: string | null
          source_type: string | null
          source_url: string | null
          updated_at: string
          velocity: number | null
          verification_status: string
          weapon_id: string
        }
        Insert: {
          accuracy_deg?: number | null
          ammo_subtype?: string | null
          ammo_type: string
          created_at?: string
          damage?: number | null
          explosion_radius_m?: number | null
          id?: string
          intra_clip_reload?: number | null
          is_guided?: boolean | null
          is_missile?: boolean | null
          last_checked_at?: string | null
          magazine_mechanism?: string | null
          magazine_size?: number | null
          module_damage?: number | null
          module_damage_bonus_pct?: number | null
          name: string
          note?: string | null
          penetration?: number | null
          penetration_reference_m?: number | null
          range?: number | null
          rate_of_fire?: number | null
          reload_seconds?: number | null
          requires_research?: boolean | null
          slug: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          velocity?: number | null
          verification_status?: string
          weapon_id: string
        }
        Update: {
          accuracy_deg?: number | null
          ammo_subtype?: string | null
          ammo_type?: string
          created_at?: string
          damage?: number | null
          explosion_radius_m?: number | null
          id?: string
          intra_clip_reload?: number | null
          is_guided?: boolean | null
          is_missile?: boolean | null
          last_checked_at?: string | null
          magazine_mechanism?: string | null
          magazine_size?: number | null
          module_damage?: number | null
          module_damage_bonus_pct?: number | null
          name?: string
          note?: string | null
          penetration?: number | null
          penetration_reference_m?: number | null
          range?: number | null
          rate_of_fire?: number | null
          reload_seconds?: number | null
          requires_research?: boolean | null
          slug?: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          velocity?: number | null
          verification_status?: string
          weapon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_ammo_weapon_id_fkey"
            columns: ["weapon_id"]
            isOneToOne: false
            referencedRelation: "vehicle_weapons"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_armor: {
        Row: {
          composition: string | null
          configuration_key: string
          effective_ap_mm: number | null
          effective_heat_mm: number | null
          id: string
          location: string
          source_type: string | null
          source_url: string | null
          thickness_mm: number | null
          upgrade_id: string | null
          vehicle_id: string
          verification_status: string
        }
        Insert: {
          composition?: string | null
          configuration_key?: string
          effective_ap_mm?: number | null
          effective_heat_mm?: number | null
          id?: string
          location: string
          source_type?: string | null
          source_url?: string | null
          thickness_mm?: number | null
          upgrade_id?: string | null
          vehicle_id: string
          verification_status?: string
        }
        Update: {
          composition?: string | null
          configuration_key?: string
          effective_ap_mm?: number | null
          effective_heat_mm?: number | null
          id?: string
          location?: string
          source_type?: string | null
          source_url?: string | null
          thickness_mm?: number | null
          upgrade_id?: string | null
          vehicle_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_armor_upgrade_id_vehicle_id_fkey"
            columns: ["upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_armor_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_armor_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_branch_memberships: {
        Row: {
          branch_id: string
          display_order: number | null
          vehicle_id: string
        }
        Insert: {
          branch_id: string
          display_order?: number | null
          vehicle_id: string
        }
        Update: {
          branch_id?: string
          display_order?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_branch_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tech_tree_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_branch_memberships_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_branch_memberships_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_capabilities: {
        Row: {
          availability: string
          capability_code: string
          effect_data: Json
          effect_description: string | null
          id: string
          last_checked_at: string | null
          source_type: string | null
          source_url: string | null
          upgrade_id: string | null
          variant_key: string
          vehicle_id: string
          verification_status: string
        }
        Insert: {
          availability?: string
          capability_code: string
          effect_data?: Json
          effect_description?: string | null
          id?: string
          last_checked_at?: string | null
          source_type?: string | null
          source_url?: string | null
          upgrade_id?: string | null
          variant_key?: string
          vehicle_id: string
          verification_status?: string
        }
        Update: {
          availability?: string
          capability_code?: string
          effect_data?: Json
          effect_description?: string | null
          id?: string
          last_checked_at?: string | null
          source_type?: string | null
          source_url?: string | null
          upgrade_id?: string | null
          variant_key?: string
          vehicle_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_capabilities_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vehicle_capabilities_upgrade_id_vehicle_id_fkey"
            columns: ["upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_capabilities_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_capabilities_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_crew_positions: {
        Row: {
          location: string | null
          note: string | null
          occupant_count: number
          position_key: string
          role: string
          source_type: string | null
          source_url: string | null
          vehicle_id: string
          verification_status: string
        }
        Insert: {
          location?: string | null
          note?: string | null
          occupant_count?: number
          position_key: string
          role: string
          source_type?: string | null
          source_url?: string | null
          vehicle_id: string
          verification_status?: string
        }
        Update: {
          location?: string | null
          note?: string | null
          occupant_count?: number
          position_key?: string
          role?: string
          source_type?: string | null
          source_url?: string | null
          vehicle_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_crew_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_crew_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_era: {
        Row: {
          ap_reduction_pct: number | null
          capability_id: string
          era_name: string | null
          era_type: string | null
          generation: number | null
          heat_reduction_pct: number | null
          is_special: boolean | null
          layer_count: number | null
        }
        Insert: {
          ap_reduction_pct?: number | null
          capability_id: string
          era_name?: string | null
          era_type?: string | null
          generation?: number | null
          heat_reduction_pct?: number | null
          is_special?: boolean | null
          layer_count?: number | null
        }
        Update: {
          ap_reduction_pct?: number | null
          capability_id?: string
          era_name?: string | null
          era_type?: string | null
          generation?: number | null
          heat_reduction_pct?: number | null
          is_special?: boolean | null
          layer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_era_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: true
            referencedRelation: "vehicle_capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_infantry: {
        Row: {
          capability_id: string
          deployment_cooldown_seconds: number | null
          infantry_type: string
          squad_count: number | null
          trooper_count: number | null
        }
        Insert: {
          capability_id: string
          deployment_cooldown_seconds?: number | null
          infantry_type?: string
          squad_count?: number | null
          trooper_count?: number | null
        }
        Update: {
          capability_id?: string
          deployment_cooldown_seconds?: number | null
          infantry_type?: string
          squad_count?: number | null
          trooper_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_infantry_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "vehicle_capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_progression_edges: {
        Row: {
          display_order: number
          edge_type: string
          from_vehicle_id: string
          id: string
          note: string | null
          source_url: string | null
          to_vehicle_id: string
          verification_status: string
        }
        Insert: {
          display_order?: number
          edge_type: string
          from_vehicle_id: string
          id?: string
          note?: string | null
          source_url?: string | null
          to_vehicle_id: string
          verification_status?: string
        }
        Update: {
          display_order?: number
          edge_type?: string
          from_vehicle_id?: string
          id?: string
          note?: string | null
          source_url?: string | null
          to_vehicle_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_progression_edges_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_progression_edges_from_vehicle_id_fkey"
            columns: ["from_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_progression_edges_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_progression_edges_to_vehicle_id_fkey"
            columns: ["to_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_token_rewards: {
        Row: {
          description: string
          id: string
          last_checked_at: string | null
          quantity: number
          source_note: string | null
          source_type: string | null
          source_url: string | null
          token_id: string
          vehicle_id: string
          verification_status: string
        }
        Insert: {
          description: string
          id?: string
          last_checked_at?: string | null
          quantity?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          token_id: string
          vehicle_id: string
          verification_status?: string
        }
        Update: {
          description?: string
          id?: string
          last_checked_at?: string | null
          quantity?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          token_id?: string
          vehicle_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_token_rewards_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_token_rewards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_token_rewards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_upgrades: {
        Row: {
          additional_effects: Json
          availability: string
          credit_cost: number | null
          effect_description: string | null
          engine_power_hp: number | null
          hp_bonus: number | null
          id: string
          is_mandatory: boolean | null
          is_vehicle_prerequisite: boolean | null
          last_checked_at: string | null
          name: string
          reverse_speed_kmh: number | null
          slug: string
          source_type: string | null
          source_url: string | null
          top_speed_kmh: number | null
          upgrade_type: string
          vehicle_id: string
          verification_status: string
          xp_cost: number | null
        }
        Insert: {
          additional_effects?: Json
          availability?: string
          credit_cost?: number | null
          effect_description?: string | null
          engine_power_hp?: number | null
          hp_bonus?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_vehicle_prerequisite?: boolean | null
          last_checked_at?: string | null
          name: string
          reverse_speed_kmh?: number | null
          slug: string
          source_type?: string | null
          source_url?: string | null
          top_speed_kmh?: number | null
          upgrade_type?: string
          vehicle_id: string
          verification_status?: string
          xp_cost?: number | null
        }
        Update: {
          additional_effects?: Json
          availability?: string
          credit_cost?: number | null
          effect_description?: string | null
          engine_power_hp?: number | null
          hp_bonus?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_vehicle_prerequisite?: boolean | null
          last_checked_at?: string | null
          name?: string
          reverse_speed_kmh?: number | null
          slug?: string
          source_type?: string | null
          source_url?: string | null
          top_speed_kmh?: number | null
          upgrade_type?: string
          vehicle_id?: string
          verification_status?: string
          xp_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_upgrades_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_upgrades_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_weapons: {
        Row: {
          accuracy: number | null
          accuracy_deg: number | null
          aim_time: number | null
          burst_size: number | null
          caliber_mm: number | null
          configuration_key: string | null
          created_at: string
          depression_deg: number | null
          elevation_deg: number | null
          id: string
          intra_clip_reload: number | null
          last_checked_at: string | null
          magazine_mechanism: string | null
          magazine_size: number | null
          name: string
          note: string | null
          range: number | null
          rate_of_fire: number | null
          reload_seconds: number | null
          requires_research: boolean | null
          role: string | null
          slug: string
          sort_order: number
          source_note: string | null
          source_type: string | null
          source_url: string | null
          updated_at: string
          vehicle_id: string
          velocity: number | null
          verification_status: string
          weapon_type: string
        }
        Insert: {
          accuracy?: number | null
          accuracy_deg?: number | null
          aim_time?: number | null
          burst_size?: number | null
          caliber_mm?: number | null
          configuration_key?: string | null
          created_at?: string
          depression_deg?: number | null
          elevation_deg?: number | null
          id?: string
          intra_clip_reload?: number | null
          last_checked_at?: string | null
          magazine_mechanism?: string | null
          magazine_size?: number | null
          name: string
          note?: string | null
          range?: number | null
          rate_of_fire?: number | null
          reload_seconds?: number | null
          requires_research?: boolean | null
          role?: string | null
          slug: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          vehicle_id: string
          velocity?: number | null
          verification_status?: string
          weapon_type: string
        }
        Update: {
          accuracy?: number | null
          accuracy_deg?: number | null
          aim_time?: number | null
          burst_size?: number | null
          caliber_mm?: number | null
          configuration_key?: string | null
          created_at?: string
          depression_deg?: number | null
          elevation_deg?: number | null
          id?: string
          intra_clip_reload?: number | null
          last_checked_at?: string | null
          magazine_mechanism?: string | null
          magazine_size?: number | null
          name?: string
          note?: string | null
          range?: number | null
          rate_of_fire?: number | null
          reload_seconds?: number | null
          requires_research?: boolean | null
          role?: string | null
          slug?: string
          sort_order?: number
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string
          vehicle_id?: string
          velocity?: number | null
          verification_status?: string
          weapon_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_weapons_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_weapons_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acceleration_0_32_seconds: number | null
          acquisition_note: string | null
          acquisition_type: string | null
          camouflage: number | null
          capability_catalog_complete: boolean
          created_at: string
          dealer_id: string | null
          engine_power_hp: number | null
          hp: number | null
          hull_traverse: number | null
          id: string
          image_url: string | null
          internal_name: string | null
          is_currently_researchable: boolean | null
          is_legendary: boolean
          is_premium: boolean | null
          last_checked_at: string | null
          name: string
          name_zh: string | null
          nation: string | null
          performance_basis: Json
          power_to_weight_hp_t: number | null
          release_status: string
          reverse_speed: number | null
          slug: string
          source_note: string | null
          source_type: string | null
          source_url: string | null
          summary: string | null
          tier: number | null
          top_speed: number | null
          turret_traverse: number | null
          updated_at: string
          vehicle_class: string | null
          verification_status: string
          view_range: number | null
          weight_t: number | null
        }
        Insert: {
          acceleration_0_32_seconds?: number | null
          acquisition_note?: string | null
          acquisition_type?: string | null
          camouflage?: number | null
          capability_catalog_complete?: boolean
          created_at?: string
          dealer_id?: string | null
          engine_power_hp?: number | null
          hp?: number | null
          hull_traverse?: number | null
          id?: string
          image_url?: string | null
          internal_name?: string | null
          is_currently_researchable?: boolean | null
          is_legendary?: boolean
          is_premium?: boolean | null
          last_checked_at?: string | null
          name: string
          name_zh?: string | null
          nation?: string | null
          performance_basis?: Json
          power_to_weight_hp_t?: number | null
          release_status?: string
          reverse_speed?: number | null
          slug: string
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          summary?: string | null
          tier?: number | null
          top_speed?: number | null
          turret_traverse?: number | null
          updated_at?: string
          vehicle_class?: string | null
          verification_status?: string
          view_range?: number | null
          weight_t?: number | null
        }
        Update: {
          acceleration_0_32_seconds?: number | null
          acquisition_note?: string | null
          acquisition_type?: string | null
          camouflage?: number | null
          capability_catalog_complete?: boolean
          created_at?: string
          dealer_id?: string | null
          engine_power_hp?: number | null
          hp?: number | null
          hull_traverse?: number | null
          id?: string
          image_url?: string | null
          internal_name?: string | null
          is_currently_researchable?: boolean | null
          is_legendary?: boolean
          is_premium?: boolean | null
          last_checked_at?: string | null
          name?: string
          name_zh?: string | null
          nation?: string | null
          performance_basis?: Json
          power_to_weight_hp_t?: number | null
          release_status?: string
          reverse_speed?: number | null
          slug?: string
          source_note?: string | null
          source_type?: string | null
          source_url?: string | null
          summary?: string | null
          tier?: number | null
          top_speed?: number | null
          turret_traverse?: number | null
          updated_at?: string
          vehicle_class?: string | null
          verification_status?: string
          view_range?: number | null
          weight_t?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      weapon_upgrade_links: {
        Row: {
          upgrade_id: string
          vehicle_id: string
          weapon_id: string
        }
        Insert: {
          upgrade_id: string
          vehicle_id: string
          weapon_id: string
        }
        Update: {
          upgrade_id?: string
          vehicle_id?: string
          weapon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weapon_upgrade_links_upgrade_id_vehicle_id_fkey"
            columns: ["upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "weapon_upgrade_links_weapon_id_vehicle_id_fkey"
            columns: ["weapon_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_weapons"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
    }
    Views: {
      aw_catalog_quality: {
        Row: {
          basic_performance_present: boolean | null
          capability_catalog_complete: boolean | null
          has_ammo_records: boolean | null
          has_armor_records: boolean | null
          has_complete_unlock_path: boolean | null
          has_crew_records: boolean | null
          has_weapon_records: boolean | null
          incomplete_unlock_paths: number | null
          name: string | null
          release_status: string | null
          slug: string | null
          vehicle_id: string | null
          verification_status: string | null
        }
        Insert: {
          basic_performance_present?: never
          capability_catalog_complete?: boolean | null
          has_ammo_records?: never
          has_armor_records?: never
          has_complete_unlock_path?: never
          has_crew_records?: never
          has_weapon_records?: never
          incomplete_unlock_paths?: never
          name?: string | null
          release_status?: string | null
          slug?: string | null
          vehicle_id?: string | null
          verification_status?: string | null
        }
        Update: {
          basic_performance_present?: never
          capability_catalog_complete?: boolean | null
          has_ammo_records?: never
          has_armor_records?: never
          has_complete_unlock_path?: never
          has_crew_records?: never
          has_weapon_records?: never
          incomplete_unlock_paths?: never
          name?: string | null
          release_status?: string | null
          slug?: string | null
          vehicle_id?: string | null
          verification_status?: string | null
        }
        Relationships: []
      }
      aw_effective_capabilities: {
        Row: {
          availability: string | null
          capability_code: string | null
          id: string | null
          source_url: string | null
          upgrade_id: string | null
          vehicle_id: string | null
          verification_status: string | null
        }
        Relationships: []
      }
      aw_tech_tree_requirements: {
        Row: {
          description: string | null
          event_code: string | null
          is_complete: boolean | null
          operator: string | null
          path_slug: string | null
          required_value: number | null
          requirement_id: string | null
          requirement_type: string | null
          source_upgrade_id: string | null
          source_url: string | null
          source_vehicle_id: string | null
          target_vehicle_id: string | null
          token_id: string | null
          unit: string | null
          unlock_path_id: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["target_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["target_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_source_upgrade_same_vehicle"
            columns: ["source_upgrade_id", "source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
      aw_token_relations: {
        Row: {
          quantity: number | null
          relation_type: string | null
          source_url: string | null
          token_code: string | null
          token_id: string | null
          unlock_path_id: string | null
          vehicle_id: string | null
          verification_status: string | null
        }
        Relationships: []
      }
      aw_upgrade_unlock_requirements: {
        Row: {
          description: string | null
          is_complete: boolean | null
          operator: string | null
          path_slug: string | null
          required_value: number | null
          requirement_id: string | null
          requirement_type: string | null
          source_upgrade_id: string | null
          source_url: string | null
          source_vehicle_id: string | null
          target_upgrade_id: string | null
          token_id: string | null
          unit: string | null
          unlock_path_id: string | null
          vehicle_id: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_paths_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "aw_catalog_quality"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "unlock_requirements_source_vehicle_id_fkey"
            columns: ["source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_requirements_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_source_upgrade_same_vehicle"
            columns: ["source_upgrade_id", "source_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
          {
            foreignKeyName: "unlock_target_upgrade_same_vehicle"
            columns: ["target_upgrade_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_upgrades"
            referencedColumns: ["id", "vehicle_id"]
          },
        ]
      }
    }
    Functions: {
      create_coop_profile: { Args: { p_profile_data?: Json }; Returns: Json }
      delete_aw_fleet_plan_item: {
        Args: {
          p_invite_code: string
          p_user_id: string
          p_vehicle_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      filter_aw_vehicles: {
        Args: {
          p_ammo_traits?: string[]
          p_dealer_slug?: string
          p_min_ap_penetration?: number
          p_nation?: string
          p_tier?: number
          p_vehicle_class?: string
          p_vehicle_traits?: string[]
        }
        Returns: {
          acceleration_0_32_seconds: number | null
          acquisition_note: string | null
          acquisition_type: string | null
          camouflage: number | null
          capability_catalog_complete: boolean
          created_at: string
          dealer_id: string | null
          engine_power_hp: number | null
          hp: number | null
          hull_traverse: number | null
          id: string
          image_url: string | null
          internal_name: string | null
          is_currently_researchable: boolean | null
          is_legendary: boolean
          is_premium: boolean | null
          last_checked_at: string | null
          name: string
          name_zh: string | null
          nation: string | null
          performance_basis: Json
          power_to_weight_hp_t: number | null
          release_status: string
          reverse_speed: number | null
          slug: string
          source_note: string | null
          source_type: string | null
          source_url: string | null
          summary: string | null
          tier: number | null
          top_speed: number | null
          turret_traverse: number | null
          updated_at: string
          vehicle_class: string | null
          verification_status: string
          view_range: number | null
          weight_t: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_aw_fleet_plan: {
        Args: { p_invite_code: string; p_workspace_id: string }
        Returns: Json
      }
      get_game_state: {
        Args: {
          p_game_key: string
          p_invite_code: string
          p_profile_id: string
        }
        Returns: Json
      }
      open_coop_profile: { Args: { p_invite_code: string }; Returns: Json }
      patch_coop_profile: {
        Args: {
          p_delete?: boolean
          p_invite_code: string
          p_path: string[]
          p_profile_id: string
          p_value?: Json
        }
        Returns: Json
      }
      patch_game_state: {
        Args: {
          p_delete?: boolean
          p_game_key: string
          p_invite_code: string
          p_path: string[]
          p_profile_id: string
          p_value?: Json
        }
        Returns: Json
      }
      put_game_state: {
        Args: {
          p_game_key: string
          p_invite_code: string
          p_profile_id: string
          p_state: Json
          p_state_schema_version?: number
        }
        Returns: Json
      }
      search_aw_vehicles: {
        Args: {
          p_ammo_traits?: string[]
          p_ap_distance_m?: number
          p_availability?: string
          p_branch_slug?: string
          p_capabilities?: string[]
          p_dealer_slug?: string
          p_era_type?: string
          p_has_era?: boolean
          p_min_ap_penetration?: number
          p_nation?: string
          p_produces_token?: string
          p_requires_token?: string
          p_tier?: number
          p_vehicle_class?: string
        }
        Returns: {
          acceleration_0_32_seconds: number | null
          acquisition_note: string | null
          acquisition_type: string | null
          camouflage: number | null
          capability_catalog_complete: boolean
          created_at: string
          dealer_id: string | null
          engine_power_hp: number | null
          hp: number | null
          hull_traverse: number | null
          id: string
          image_url: string | null
          internal_name: string | null
          is_currently_researchable: boolean | null
          is_legendary: boolean
          is_premium: boolean | null
          last_checked_at: string | null
          name: string
          name_zh: string | null
          nation: string | null
          performance_basis: Json
          power_to_weight_hp_t: number | null
          release_status: string
          reverse_speed: number | null
          slug: string
          source_note: string | null
          source_type: string | null
          source_url: string | null
          summary: string | null
          tier: number | null
          top_speed: number | null
          turret_traverse: number | null
          updated_at: string
          vehicle_class: string | null
          verification_status: string
          view_range: number | null
          weight_t: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_aw_vehicle_plan_status: {
        Args: {
          p_invite_code: string
          p_status: string
          p_user_id: string
          p_vehicle_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      upsert_aw_fleet_plan_item: {
        Args: {
          p_invite_code: string
          p_note?: string
          p_priority?: number
          p_role?: string
          p_user_id: string
          p_vehicle_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

