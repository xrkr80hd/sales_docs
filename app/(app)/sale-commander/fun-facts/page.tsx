"use client";
import Link from "next/link";
export default function SaleCommanderFunFacts(){
return <main style={{maxWidth:780,margin:"auto",padding:20,color:"#f2f5f8"}}>
<p style={{color:"#ef6375",fontWeight:800,letterSpacing:2}}>CONSULTANT TOOLS · FUN FACTS</p>
<h1>How do we get the sales activity numbers?</h1>
<p>Sale Commander turns your monthly sales objective into a daily activity plan. These are estimates, not guaranteed outcomes.</p>
<section style={{padding:18,border:"1px solid #43505e",borderRadius:6,background:"#141e28"}}>
<h2>The numbers game</h2>
<ol>
<li>Start with your monthly vehicle sales objective.</li>
<li>Divide by the percentage of shown appointments that purchase to estimate shows.</li>
<li>Divide by the appointment show rate to estimate appointments set.</li>
<li>Divide by the conversations-to-appointment rate to estimate real conversations.</li>
<li>Divide by the calls-to-conversation rate to estimate outbound calls.</li>
<li>Add the activity cushion, then divide by planned workdays. Round required activity up.</li>
</ol>
<p><strong>Example conversion assumptions:</strong> 22% calls to real conversations, 40% conversations to appointments, 59% appointments shown, 40% shows to sold, plus a 2% activity cushion. Actual results vary by dealership, salesperson and lead source.</p>
<p>The outbound calling and conversation rates above are planning assumptions, not independently verified Walker Automotive conversion rates. Use dealership history to refine them.</p>
</section>
<section style={{marginTop:18}}><h2>Research and further reading</h2><p><a href="https://www.foureyes.io/blog/dealership-data-study-appointment-rates" target="_blank" rel="noreferrer">Foureyes dealership study</a> · <a href="https://www.foureyes.io/blog/dealership-appointment-set-rates" target="_blank" rel="noreferrer">Foureyes appointment rates</a> · <a href="https://www.spyne.ai/blogs/dealership-ai-benchmarks" target="_blank" rel="noreferrer">Automotive benchmark summary</a></p></section>
<p><Link href="/dashboard">Return to Sales Commander</Link></p>
</main>;
}