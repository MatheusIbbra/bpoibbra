import { type ReactNode, type ComponentType } from "react";

type ProviderComponent = ComponentType<{ children: ReactNode }>;

interface Props {
  providers: ProviderComponent[];
  children: ReactNode;
}

export function ContextComposer({ providers, children }: Props) {
  return providers.reduceRight<ReactNode>(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  ) as JSX.Element;
}
