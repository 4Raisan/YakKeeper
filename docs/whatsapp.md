# Administrator WhatsApp alerts

Status: configuration is not set up. No live message has been sent or confirmed. The transport and failure handling are tested with simulated Meta responses.

Alerts are optional and only cover new ideas/join requests on the administrator's own projects. Other publishers and applicants use the in-app Applications inbox. There is no collection of other users' phone numbers or automatic opt-in.

## Cost

Do not assume automated alerts are free. Meta charges based on delivered message category and recipient market; exceptions and service windows do not guarantee free background project alerts. Check the current [official pricing](https://business.whatsapp.com/products/platform-pricing) and your approved template category before enabling delivery. Recipient-wide alerts are intentionally not enabled.

## Setup

1. In Meta, create a Business app with WhatsApp, configure its business phone number and verify the intended recipient. Complete account, credential and phone verification yourself.
2. Obtain a server access token with the permissions required by the WhatsApp Cloud API. Store it in server environment settings, never in chat, source control or browser-visible variables.
3. Create and obtain approval for a template with three body parameters: request kind, project title, and inbox URL. Example content: `New {{1}} for {{2}}. Review it here: {{3}}`. Meta decides its category and approval.
4. Configure the following server values in the target deployment:

   - `META_WHATSAPP_TOKEN`: token, kept secret.
   - `META_PHONE_NUMBER_ID`: Meta's numeric phone-number ID, not the recipient's number.
   - `META_GRAPH_VERSION`: a supported Graph API version from your Meta dashboard.
   - `WHATSAPP_TO`: administrator recipient in international format.
   - `WHATSAPP_TEMPLATE`: approved template name.
   - `WHATSAPP_LANGUAGE`: template language, such as `en_US`.
   - `APP_URL`: the production HTTPS website origin.
   - `WHATSAPP_ENABLED=true`: explicit delivery opt-in; defaults to disabled.

5. Redeploy after setting production environment values. Perform the first real test only with the administrator's approved recipient. Local sandbox submissions never send live alerts; non-administrator projects stay in-app only.
6. Review the application's expanded Details for alert status. `accepted by Meta (delivery unconfirmed)` means Meta returned a message ID; it is not evidence the phone received the message.

## Failure behavior and limits

The application is saved before notification. Disabled/missing/invalid configuration is recorded without sending. Provider errors and timeouts record a safe status without exposing the token or raw provider text. A status-storage failure is logged without failing the saved application. No automatic retry is performed, avoiding accidental duplicates. This version does not implement delivery webhooks, read receipts, recipient-specific subscriptions or alerts when an application is accepted.

Local setup check (outputs only readiness and missing variable names):

```powershell
node --experimental-strip-types --env-file=.env.local --input-type=module -e "import {whatsappConfiguration} from './src/lib/hub-whatsapp.ts'; console.log(whatsappConfiguration())"
```
