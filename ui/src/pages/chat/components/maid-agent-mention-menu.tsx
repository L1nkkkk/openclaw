import { MaidMentionPicker } from "../../../components/maid-atelier-mention-picker.tsx";
import type { MaidMentionAgent } from "../../../components/maid-atelier-mentions.ts";
import { paneDomId } from "./chat-composer-dom.ts";
import type { MaidAgentMentionMenu } from "./maid-agent-mention-menu.ts";

export function MaidAgentMentionMenuView(props: {
  menu: MaidAgentMentionMenu;
  paneId: string;
  onSelect: (agent: MaidMentionAgent) => void;
  onHover: (index: number) => void;
}) {
  return (
    <MaidMentionPicker
      id={paneDomId(props.paneId, "maid-mention-menu")}
      agents={props.menu.choices}
      activeIndex={props.menu.index}
      optionId={(index) => paneDomId(props.paneId, `maid-mention-option-${index}`)}
      onSelect={props.onSelect}
      onHover={props.onHover}
    />
  );
}
