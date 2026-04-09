/**
 * This file contains utility functions for general use across the backend of the project
 */
import { Database } from "./supabaseServerSchema";

export type User = Database["public"]["Tables"]["User"]["Row"];