import CRM from './crm';
import {requireChatGPTUser} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <CRM userName={user.fullName||user.displayName} userEmail={user.email}/>;}
