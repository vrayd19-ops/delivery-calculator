'use client';

type DeleteUserButtonProps = {
  action:
    (
      formData: FormData
    ) => Promise<void>;

  email:
    string;
};


export default function DeleteUserButton({
  action,
  email,
}: DeleteUserButtonProps) {
  return (
    <button
      type="submit"
      formAction={
        action
      }
      formNoValidate
      className="btn secondary"
      style={{
        color:
          '#9b3f3f',

        borderColor:
          '#e7c6c6',

        background:
          '#fff7f7',
      }}
      onClick={
        (
          event
        ) => {
          const confirmed =
            window.confirm(
              `Удалить пользователя ${email}?\n\n` +
              'Учётная запись будет удалена, но его старые расчёты и заявки останутся в системе.'
            );

          if (
            !confirmed
          ) {
            event.preventDefault();
          }
        }
      }
    >
      Удалить пользователя
    </button>
  );
}