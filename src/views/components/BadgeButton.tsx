import * as React from 'react';
import classNames from 'clsx';
import { Button } from '@rmwc/button';
import { Badge } from '@rmwc/badge';
import { useStore } from './contexts';

type Props<T> = T extends (props: infer P, ...args: never[]) => any ? P : never;

export interface BadgeButtonProps extends Props<typeof Button> {
  promotion: string,
}

export const BadgeButton = React.forwardRef<HTMLButtonElement, BadgeButtonProps>(
  ({ promotion, className, onClick, children, ...otherProps }, ref) => {
    const store = useStore();
    return (
        <Button
          {...otherProps}
          ref={ref}
          className={classNames(className, 'badge-button')}
          onClick={() => {
            store.promotion.off(promotion);
            return onClick();
          }}
        >
          {children}
          <Badge className="badge-button_badge" exited={!store.promotion.get(promotion)} />
        </Button>
    );
  });
