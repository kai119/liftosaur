import { JSX, ReactNode } from "react";
import { Pressable, Linking } from "react-native";
import { Text } from "./components/primitives/text";
import { Config } from "./config";

interface IProps {
  href: string;
  className?: string;
  children: ReactNode;
  name: string;
}

export function InternalLink(props: IProps): JSX.Element {
  const url = props.href.startsWith("/") ? `${Config.host}${props.href}` : props.href;
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(url).catch(() => undefined);
      }}
    >
      {typeof props.children === "string" || Array.isArray(props.children) ? (
        <Text className={props.className}>{props.children}</Text>
      ) : (
        props.children
      )}
    </Pressable>
  );
}
