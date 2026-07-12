const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert(app.includes('function showPaymentCustomerPrompt'), 'payment customer prompt should exist');
assert(app.includes('id="paymentCustomerName"'), 'payment customer name input should be rendered');
assert(app.includes('data-modal-action="confirm-payment"'), 'payment prompt should have explicit confirm button');
assert(app.includes('state.ticketMeta.CustomerName = $(\'paymentCustomerName\').value.trim()'), 'confirmed customer name must update ticket meta before build');
assert(app.includes('state.ticketMeta.TableNumber = $(\'paymentTableNumber\').value.trim()'), 'confirmed table number must update ticket meta before build');
assert(app.indexOf('state.ticketMeta.CustomerName = $(\'paymentCustomerName\').value.trim()') < app.indexOf('var payload = Core.buildTicketPayload'), 'customer name must be set before ticket payload is built');
assert(app.includes("state.ticketMeta.TableNumber = '';"), 'table number should clear after confirmed save');
assert(app.includes("state.ticketMeta.CustomerName = '';"), 'customer name should clear after confirmed save');
assert(app.includes('inactive-admin-tile'), 'inactive item list tile class should be rendered');
assert(app.includes('inactive-admin-panel'), 'inactive admin panel class should be rendered');
assert(app.includes('NOT ACTIVE'), 'inactive sticker text should be rendered');
assert(css.includes('.inactive-admin-tile') && css.includes('.inactive-admin-panel'), 'inactive admin CSS should exist');
assert(css.includes('.not-active-sticker'), 'NOT ACTIVE sticker CSS should exist');

console.log('App static tests passed');
assert(app.includes('saveConfirmedUrlAfterGoodConnection'), 'confirmed URL should be saved after a good connection');
assert(app.includes('data-action="copy-confirmed-url"'), 'settings should include copy confirmed URL action');
assert(app.includes('data-action="save-confirmed-url"'), 'settings should include manual save confirmed URL action');
assert(app.includes('renderDeletedItemsAdmin'), 'admin should render deleted items archive view');
assert(app.includes("archiveDeleteEntity('MenuItem'"), 'item delete should archive-delete, not deactivate');
assert(app.includes("archiveDeleteEntity('Prompt'"), 'prompt delete should archive-delete, not deactivate');
assert(app.includes("archiveDeleteEntity('PromptOption'"), 'option delete should archive-delete, not deactivate');
assert(css.includes('.confirmed-url-card'), 'confirmed URL card CSS should exist');
assert(css.includes('.deleted-admin-row'), 'deleted archive row CSS should exist');
