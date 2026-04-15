/**
 * Templates in DSL format
 * These DSL strings can be parsed and converted to shapes using the DSL converter
 */

export const TEMPLATES_DSL: Record<string, string> = {
  'decision-tree': `# Decision Tree Template
diamond:root "Decision?" at(-90,0)
rect:yes "Yes" at(-210,100) width:160 height:52 stroke:#22c55e
rect:no "No" at(210,100) width:160 height:52 stroke:#ef4444
ellipse:yesEnd "Result A" at(-210,200) width:140 height:52 stroke:#22c55e
ellipse:noEnd "Result B" at(210,200) width:140 height:52 stroke:#ef4444
root -> yes type:arrow from:left to:right text:"Yes"
root -> no type:arrow from:right to:left text:"No"
yes -> yesEnd type:arrow from:bottom to:top
no -> noEnd type:arrow from:bottom to:top`,

  'flowchart': `# Flowchart Template
ellipse:start "Start" at(-80,0) width:160 height:52 stroke:#6366f1
rect:process "Process" at(-80,132) width:160 height:52 stroke:#6366f1
diamond:decide "Condition?" at(-100,264) stroke:#6366f1
rect:yes "Yes path" at(-80,396) width:160 height:52 stroke:#22c55e
rect:no "No path" at(140,332) width:160 height:52 stroke:#ef4444
ellipse:end "End" at(-80,528) width:160 height:52 stroke:#6366f1
start -> process type:arrow from:bottom to:top
process -> decide type:arrow from:bottom to:top
decide -> yes type:arrow from:bottom to:top text:"Yes"
decide -> no type:arrow from:right to:left text:"No"
yes -> end type:arrow from:bottom to:top`,

  'db-schema': `# DB Schema Template
dbtable:users "users" at(0,0) width:220 col:id:INT:pk col:name:VARCHAR col:email:VARCHAR col:created_at:TIMESTAMP
dbtable:orders "orders" at(300,0) width:220 col:id:INT:pk col:user_id:INT:fk col:total:DECIMAL col:status:VARCHAR col:created_at:TIMESTAMP
dbtable:items "order_items" at(600,0) width:220 col:id:INT:pk col:order_id:INT:fk col:product:VARCHAR col:quantity:INT col:price:DECIMAL
users -> orders type:arrow from:col-0-right to:col-1-left
orders -> items type:arrow from:col-0-right to:col-1-left`,

  'user-flow': `# User Flow Template
rect:login "Login" at(0,0) width:150 height:52 stroke:#06b6d4
rect:dashboard "Dashboard" at(180,0) width:150 height:52 stroke:#06b6d4
diamond:action "Action?" at(330,-10) stroke:#06b6d4
rect:success "Success" at(510,-20) width:150 height:52 stroke:#22c55e
rect:error "Error" at(510,52) width:150 height:52 stroke:#ef4444
ellipse:logout "Logout" at(0,152) width:150 height:52 stroke:#06b6d4
login -> dashboard type:arrow from:right to:left
dashboard -> action type:arrow from:right to:left
action -> success type:arrow from:right to:left text:"Yes"
action -> error type:arrow from:bottom to:left text:"No"
login -> logout type:arrow from:bottom to:top`,

  'mind-map': `# Mind Map Template
rect:center "Main Idea" at(-80,-26) width:160 height:52 stroke:#f59e0b fill:#1c1310
rect:topic1 "Topic 1" at(-350,-120) width:130 height:44 stroke:#8b5cf6
rect:topic3 "Topic 3" at(-350,50) width:130 height:44 stroke:#22c55e
rect:topic2 "Topic 2" at(170,-120) width:130 height:44 stroke:#06b6d4
rect:topic4 "Topic 4" at(170,50) width:130 height:44 stroke:#f43f5e
topic1 -> center type:arrow from:right to:left endArrowhead:none stroke:#8b5cf6
topic3 -> center type:arrow from:right to:left endArrowhead:none stroke:#22c55e
topic2 -> center type:arrow from:left to:right endArrowhead:none stroke:#06b6d4
topic4 -> center type:arrow from:left to:right endArrowhead:none stroke:#f43f5e`,

  'swot': `# SWOT Analysis Template
rect:strengths "Strengths" at(0,0) width:300 height:200 stroke:#22c55e fill:#f0fdf4
rect:weaknesses "Weaknesses" at(304,0) width:300 height:200 stroke:#ef4444 fill:#fef2f2
rect:opportunities "Opportunities" at(0,204) width:300 height:200 stroke:#06b6d4 fill:#f0f9ff
rect:threats "Threats" at(304,204) width:300 height:200 stroke:#f59e0b fill:#fffbeb`,

  'org-chart': `# Org Chart Template
rect:ceo "CEO" at(-70,0) width:140 height:48 stroke:#6366f1 fill:#eef2ff
rect:mgr1 "Manager 1" at(-250,120) width:140 height:48 stroke:#8b5cf6
rect:mgr2 "Manager 2" at(-70,120) width:140 height:48 stroke:#8b5cf6
rect:mgr3 "Manager 3" at(110,120) width:140 height:48 stroke:#8b5cf6
rect:emp1 "Employee 1" at(-380,200) width:119 height:41 stroke:#a78bfa
rect:emp2 "Employee 2" at(-250,200) width:119 height:41 stroke:#a78bfa
rect:emp3 "Employee 3" at(-120,200) width:119 height:41 stroke:#a78bfa
rect:emp4 "Employee 4" at(10,200) width:119 height:41 stroke:#a78bfa
rect:emp5 "Employee 5" at(140,200) width:119 height:41 stroke:#a78bfa
rect:emp6 "Employee 6" at(270,200) width:119 height:41 stroke:#a78bfa
ceo -> mgr1 type:arrow from:bottom to:top endArrowhead:none
ceo -> mgr2 type:arrow from:bottom to:top endArrowhead:none
ceo -> mgr3 type:arrow from:bottom to:top endArrowhead:none
mgr1 -> emp1 type:arrow from:bottom to:top endArrowhead:none
mgr1 -> emp2 type:arrow from:bottom to:top endArrowhead:none
mgr2 -> emp3 type:arrow from:bottom to:top endArrowhead:none
mgr2 -> emp4 type:arrow from:bottom to:top endArrowhead:none
mgr3 -> emp5 type:arrow from:bottom to:top endArrowhead:none
mgr3 -> emp6 type:arrow from:bottom to:top endArrowhead:none`,

  'timeline': `# Timeline Template
# Only milestone cards (axis and dots use binding-less shapes in original)
rect:card1 "Q1" at(-65,-136) width:130 height:52 stroke:#6366f1
rect:card2 "Q2" at(115,-136) width:130 height:52 stroke:#6366f1
rect:card3 "Q3" at(295,-136) width:130 height:52 stroke:#6366f1
rect:card4 "Q4" at(475,-136) width:130 height:52 stroke:#6366f1
rect:card5 "Q5" at(655,-136) width:130 height:52 stroke:#6366f1`,

  'uml-class': `# UML Class Template
rect:userHeader "User" at(0,0) width:200 height:44 stroke:#6366f1 fill:#eef2ff
rect:userAttrs at(0,44) width:200 height:84 stroke:#6366f1
rect:userMeths at(0,128) width:200 height:84 stroke:#6366f1
rect:orderHeader "Order" at(200,0) width:200 height:44 stroke:#6366f1 fill:#eef2ff
rect:orderAttrs at(200,44) width:200 height:84 stroke:#6366f1
rect:orderMeths at(200,128) width:200 height:84 stroke:#6366f1
userHeader -> orderHeader type:arrow from:right to:left endArrowhead:triangle text:"has many"`,

  'venn': `# Venn Diagram Template
ellipse:setA "Set A" at(-190,-132) width:220 height:220 stroke:#6366f1 fill:#6366f1 opacity:0.25
ellipse:setB "Set B" at(-30,-132) width:220 height:220 stroke:#ec4899 fill:#ec4899 opacity:0.25
ellipse:setC "Set C" at(-110,28) width:220 height:220 stroke:#f59e0b fill:#f59e0b opacity:0.25`,

  'fishbone': `# Fishbone Template
# Only labels (spine and ribs use binding-less shapes in original)
rect:method "Method" at(-175,-129) width:110 height:44 stroke:#64748b
rect:machine "Machine" at(-50,-129) width:110 height:44 stroke:#64748b
rect:material "Material" at(-175,81) width:110 height:44 stroke:#64748b
rect:people "People" at(-50,81) width:110 height:44 stroke:#64748b
rect:problem "Problem" at(500,-26) width:120 height:52 stroke:#ef4444 fill:#fef2f2`,

  'wireframe': `# Wireframe Template
rect:header "Header / Nav" at(0,-12) width:720 height:60 stroke:#94a3b8 fill:#f1f5f9
rect:sidebar "Sidebar" at(0,64) width:160 height:400 stroke:#94a3b8 fill:#f8fafc
rect:footer "Footer" at(0,472) width:720 height:48 stroke:#94a3b8 fill:#f1f5f9
rect:content1 "Content 1" at(168,64) width:552 height:120 stroke:#cbd5e1
rect:content2 "Content 2" at(168,200) width:552 height:120 stroke:#cbd5e1
rect:content3 "Content 3" at(168,336) width:552 height:120 stroke:#cbd5e1`,
};

/**
 * Helper function to parse DSL template and convert to shapes
 */
export function parseTemplateDSL(templateKey: string): any[] {
  const dslText = TEMPLATES_DSL[templateKey];
  if (!dslText) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  // Import dynamically to avoid circular dependencies
  const { dslToJson, jsonToShapes } = require('../dsl/converter');
  
  const doc = dslToJson(dslText);
  return jsonToShapes(doc);
}
