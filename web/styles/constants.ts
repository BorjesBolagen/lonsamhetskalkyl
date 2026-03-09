/**
 * Centraliserade styling-konstanter för konsistent design
 * Alla sidor använder denna fil för gemensam styling
 */

// Färgpalett
export const colors = {
  white: "#ffffff",
  black: "#000000",
  lightGray: "#f0f0f0",
};

// Border-stil
export const border = {
  standard: "1px solid black",
};

// Page layout - huvudcontainer för sidor med Navigation
export const pageContainer = {
  minHeight: "100vh",
  backgroundColor: colors.white,
  color: colors.black,
  display: "flex",
  flexDirection: "column" as const,
  paddingTop: "80px",
};

// Page layout - huvudcontainer för sidor utan Navigation (login)
export const pageContainerNoNav = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: "100vh",
  backgroundColor: colors.white,
  color: colors.black,
  width: "100%",
};

// Content wrapper - div som innehåller sidans innehåll
export const contentWrapper = {
  padding: "40px",
  maxWidth: "1000px",
  margin: "0 auto",
  flex: 1,
};

// Centered content container - för login forms
export const centeredContentContainer = {
  flex: 1,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  width: "100%",
};

// Box/Card - för innehålls-boxar på sidorna
export const box = {
  border: border.standard,
  padding: "20px",
  marginTop: "20px",
};

// Button - standard knapp-stil
export const button = {
  padding: "10px 20px",
  border: border.standard,
  backgroundColor: colors.white,
  color: colors.black,
  cursor: "pointer",
};

// Button - disabled state
export const buttonDisabled = {
  ...button,
  cursor: "not-allowed",
  opacity: 0.6,
};

// Input/Textarea - standard input-stil
export const input = {
  padding: "8px",
  border: border.standard,
};

// Textarea - standard textarea-stil
export const textarea = {
  padding: "8px",
  border: border.standard,
  width: "100%",
  minHeight: "100px",
  fontFamily: "monospace",
  boxSizing: "border-box" as const,
};

// Form - wrapper för formulär
export const form = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
  marginTop: "20px",
};

// Link - standard länk-stil
export const link = {
  marginTop: "20px",
  padding: "10px 20px",
  border: border.standard,
  textDecoration: "none",
  color: colors.black,
  display: "inline-block" as const,
};

// Navigation container - för nav items
export const navContainer = {
  backgroundColor: colors.white,
  padding: "20px",
  borderBottom: border.standard,
  position: "fixed" as const,
  top: 0,
  left: 0,
  right: 0,
  width: "100%",
  zIndex: 999,
};

// Footer - sidfot-styling
export const footer = {
  background: colors.lightGray,
  color: colors.black,
  padding: "20px",
  textAlign: "center" as const,
  borderTop: border.standard,
  width: "100%",
  marginTop: "auto",
};

// Navigation flex containers
export const navFlex = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const navGroup = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
};

export const navCenter = {
  display: "flex",
  gap: "10px",
  position: "absolute" as const,
  left: "50%",
  transform: "translateX(-50%)",
};

export const navRight = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
};
