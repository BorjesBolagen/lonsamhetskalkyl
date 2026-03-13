/* This file containts utility functions and types for the backend
*/

import { Enums } from "@/lib/supabaseServerSchema";

export type SignupPayload = {
  email: string;
  password: string;
  role: Enums<"User_specialization_types">;
};

export type LoginPayload = {
  email: string;
  password: string;
};

// Email validation function using regex
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};