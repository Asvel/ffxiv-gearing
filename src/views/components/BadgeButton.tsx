import * as React from 'react';
import { Button } from '@rmwc/button';
import { Badge, BadgeAnchor } from '@rmwc/badge';
import { useStore } from './contexts';

type Props<T> = T extends (props: infer P, ...args: never[]) => any ? P : never;

export interface BadgeButtonProps extends Props<typeof Button> {
  promotion: string,
}

export const BadgeButton = React.forwardRef<HTMLButtonElement, BadgeButtonProps>(
  ({ promotion, onClick, ...otherProps }, ref) => {
    const store = useStore();
    return (
      <BadgeAnchor>
        <Button
          {...otherProps}
          ref={ref}
          onClick={() => {
            store.promotion.off(promotion);
            return onClick();
          }}
        />
        <Badge className="badge-button_badge" exited={!store.promotion.get(promotion)} />
      </BadgeAnchor>
    );
  });
