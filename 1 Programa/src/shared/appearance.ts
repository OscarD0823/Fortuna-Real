import { createContext, useContext } from "react";

export const NeutralAppearanceContext = createContext(false);
export const useNeutralAppearance = () => useContext(NeutralAppearanceContext);
