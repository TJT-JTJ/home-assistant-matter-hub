import type { EndpointData } from "@home-assistant-matter-hub/common";

export interface EndpointNameProps {
  endpoint: EndpointData;
}

export const EndpointName = ({ endpoint }: EndpointNameProps) => {
  return getEndpointName(endpoint.state) ?? endpoint.id.local;
};

export function getEndpointName(state: object): string | undefined {
  if ("basicInformation" in state) {
    const basicInformation = state.basicInformation as { nodeLabel: string };
    return basicInformation.nodeLabel;
  }
  if ("bridgedDeviceBasicInformation" in state) {
    const basicInformation = state.bridgedDeviceBasicInformation as {
      nodeLabel: string;
    };
    return basicInformation.nodeLabel;
  }
  return undefined;
}
