# MindBoat

### **The core thread: a complete focused sailing experience**

 This main task can be defined as follows:

**The user sets a specific task, stays focused in "sailing mode" and gets simple feedback at the end.**

<aside>
💡

**Read the documentation for instructions:**

- **Uncollapsed**: The core elements of the project, prioritized for completion.
- **Collapsed**: The full version of the document, with more detailed interface design examples and explanations to help understand the design intent.

 It is recommended to follow the implementation of the unfolded core parts first, and then refer to the folded content for additional details.

- **Original full version (if you want the whole interaction framework and story): https:**[//www.notion.so/21e5155f416280b58e1bc743c3d51165](https://www.notion.so/21e5155f416280b58e1bc743c3d51165?pvs=21)
</aside>

---

# **Phase 1: Onboarding & Setup**

 The goal of this phase is to allow the user to quickly set up their goals and start their first voyage.

### **Setting the "star" (entering the overall goal)**

**Necessary**: Provide a simple input box for the user to fill in their long term goals.

**Simplification**: Omit the guided questioning and naming ceremony, and go directly to the next step after the user enters the goal.

- **Introduction to the worldview of [Chugoku Hi-U]**
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image.png)
    
    - **Interactive opening animation:** Use several pages of hand-drawn illustrations to tell the story of "There is an ocean inside everyone, and at the end of the ocean is the lighthouse you want to be", to quickly establish emotional resonance.
    - **Core Metaphor Definition:** Clearly inform users: **boat** = yourself; **lighthouse** = your ideal self; **navigation** = focused action; **map** = your journey.
    
    <aside>
    💡
    
    **Front-end and back-end data interaction process**: After the front-end inputs the total goal on the web page, it needs to exist in some cached place, and subsequently needs to be sent together to the LLM as part of the LLM's USER PROMOTE. This data is used to subsequently determine whether the user is distracted.
    
    </aside>
    
- **[LEO] Guided Questioning.**
    - **Guided Questioning:**Lead with the question, "In the distant future, when friends mention you, what words would you like them to use to describe you?" , "What is your most important mission at the moment in order to become that version of yourself?"  *Purple is some of Quack's experiments or found material or expectations to carry out (TODO is included) (the questions should not be too long, 1-3 at most)
    - 
    - 
    
    <aside>
    💡
    
     This animation process is fixed
    
    </aside>
    
- **[Medium-high superiority] Ritual moving drawing**
    - **Naming Ceremony:** After the user writes down a goal, the App says, "So, let's name this lighthouse '[user-entered goal]'."
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%201.png)
    
    - **"Rise the Lighthouse" animation:** The user confirms, triggering the "Star Trails Converge" animation you've conceived, where a lighthouse of stars is lit up on the distant horizon, piercing the clouds with its light.

### **Define "Wind of Ideas" (Create Single Task)**

**Required Function**: Allows the user to create a list of specific "todo's" that will serve as the destination for a single voyage. For example, if the user enters "Finish Paper", the system generates "Academic Paper Continuum".

**Core technology**: LLM is used to transform user-entered tasks (e.g., "Write a paper") into imaginative destination names (e.g., "Academic Continents") and associated applications (e.g., Zotero, Notion, Word). This is one of the core attractions for users.

**Simplify the process**: AI-generated images can be temporarily replaced by a fixed number of illustrations to save development time.

**Visual and Interaction:** pretty much the same as collapsed below, just delete the multiple goals part

- **[Low Low Superiority] Define Multiple Targets :**
    - **Functional Description.**
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%202.png)
    
    - Tell the user that "Winds of Intention" are the winds that blow when you focus on a goal. When your actions are in line with the wind, the sails are set. Different winds will take you to different destinations.
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%203.png)
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%204.png)
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%205.png)
    
    - **Create and manage adventure maps:** Users can create a list of "todo's" that will become your adventure destinations, for example:
    - User inputs need to complete a paper -> Academic paper continent
    - user input need to finish coding -> code fjord
    - User input wants to practice piano -> Artistic Piano Spring
    - User wants to get fit -> Healthy Mountains
    
     After user input, there will be a popup box to confirm the addition, an ai generated image will appear, and text similar to "academic continent".
    
    <aside>
    💡
    
     Technology: use LLM fixed format json output, fixed format title and description of the picture, to facilitate the ai generation of the corresponding style of picture.
    
    </aside>
    
    - The right paragraph is an introduction, LLM generated and sent to the front end. Example:
    - Academic Continuum -> Zotero, Notion, Word
    - Code Fjord -> VS Code, GitHub, Terminal
    
     The "winds" that take you to different destinations have unique symbols or colors, which leave different colored tracks on the map.
    
     After confirming the addition of a destination, the different destinations will be added to the home screen.
    

---

# **Phase 2: The Core Loop - The Core**

 This is the core of the product and the core mechanism of focus and yaw must be fully implemented.

### **Preparing to sail**

- **Required Features**.
    1.  The user selects a destination from the list of destinations created in the "Winds of Thought" phase as the goal of the voyage.
    2.  Request the necessary authorizations (microphone, screen, camera) and state clearly why.
    3.  Click on "Sail" to enter the "Sailing Mode".
    4.  The system starts to record the duration.
- **Advance UI and watch linkage**
    
    ### **Preparing for sailing.**
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%206.png)
    
    - **Start sailing process: there is a word of encouragement on the screen, the user or ai reads it out and then sails.**
    - **Visual elements:** the user's boat is in the center of the screen, and the faint star of enlightenment is in the distance.
    - **Interaction flow:**
        - Can choose the previous destination (todo), ~~or talk to the wind (voice input) to generate a new goal (hackathon not to do)~~
        - Let the user choose the destination of the voyage to "code fjord", then the wind of code will blow.
        - Perform authorization: microphone and screen and camera open authorization, and explain the reason (to confirm that you are sailing, to remind you when yawing)
        - After confirmation, the app enters "sailing mode".
        - The system reads out the words of encouragement and starts sailing!
        
        <aside>
        💡
        
         Technology: We'll be getting sleep, fitness and stress data from apple health. The weather system (sunny, cloudy, rainy, windy) can be correlated with the user's health status.
        
         But it won't be done in this hackathon. **But it will be reflected in the UI**.
        
        </aside>
        

### **Sailing Mode**

- **Necessary Functions**: Visual Feedback
    1. **Visual feedback**: a boat sailing in the center of the interface.
    2. **Sound environment**: play white noise, such as waves.
    3. **Yaw Detection**: **This is the key point of the technology.** Detecting user distraction through a trio of sensors (camera, microphone, screen sharing). For example, it recognizes that the user has opened a website in a preset list of "distracting apps".
- Click to see what the ai is currently monitoring, and turn off the sensor suite if you don't want to share.
    
    ### Full version of **Sailing Mode.**
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%207.png)
    
    **Visual feedback:** The boat starts sailing on the sea, leaving a trail behind it that corresponds to the color of the "Wind of Thought". The light and shadow effects on the sky and the sea change with the passage of time (sunrise, noon, dusk, starry night).
    
    **Sound environment:** Play carefully designed white noise (waves, breeze, wooden sounds of ships) to avoid any distracting UI.
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%208.png)
    
     You can click to see what the current ai is monitoring, and when you encounter one you don't want to SHARE you can temporarily turn off the sensor trio (camera, microphone, screen share)
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%209.png)
    
     The state of the page after shrinking, but hackathon can be ignored for now.
    

<aside>
💡

 If you mention "sensor suite" later, it means "camera, microphone, screen sharing".

</aside>

- **Resting state**
    
    ## **Resting.**
    
     If the person is found to be playing with his/her cell phone occasionally (5 minutes after 20 minutes of work, this is not a distraction, it is a break), the screen will show a person playing with his/her cell phone. The screen will show a person leisurely fishing. The ship will not advance.
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%2010.png)
    
    ### First break triggered event:
    
     The first time the user takes a break, he meets his "buddy", a seagull that came with the boat. Since you gave it a fish to eat, it sails with you all the time.
    
    ![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%2011.png)
    
    <aside>
    💡
    
    **Why introduce a new element here:** I don't want to start with too much information. It's a good time to introduce this animal while the user is taking a break, so that it can be used as a conversational "ai assistant" in the future.
    
    </aside>
    

### **Deviation&Discovery**

- **Essential Features**.
    1.  The system should give feedback when it detects user distraction.
    2. **Visual changes**: the sea becomes gray and foggy.
    3. **Alerts**: Non-judgmental alerts such as "The captain is yawing! Do you want to go back?" .
    4. **User Choice**: Offers the options `[Return to Course]` and `[I'm Exploring]`. Selecting "Back to Course" resumes normal navigation; selecting "I'm Exploring" puts you in exploration mode, temporarily stopping distraction detection.
    
- **Discovery (after completing the main line)**
    
     When the system sends out a yawning reminder: "Captain is yawing! Do you want to go back?"
    
     The user can reply by voice or by selecting the on-screen buttons: `[ Return to course ]` `[ I'm exploring ]` The ai will then turn into Discovery Recorder mode. Reply: "Roger, Captain! **Exploration mode is on.** Feel free to page me at any time, or use the system's 'share' feature to 'capture' your inspiration. All discoveries will be securely stored in your logbook."
    
    > Reason:
    > 
    
    > **From Reactive Correction to Proactive Empowerment:** When the system issues a yaw alert, it's no longer a simple yes/no question. You're giving the user a third option, an empowering option - "No, I'm not making a mistake, I'm creating value." This changes the tone of the product from "supervisor" to "partner".
    > 
    
    > **Intelligent Assistant in Dynamic Contexts:** The role of the AI seamlessly switches from a "navigator" to a "scribe" or "research assistant" based on user feedback. This makes the AI smarter and more attentive, and it understands the user's real needs at the moment.
    > 
    
    - **[Inspiration Capture] (Various ways, user's choice)**
        - **Voice Notes:** Users can say to their phone at any time (using a wake word such as "Record Inspiration" or holding down a hover button), "I just realized that the design style of this website can be used in my project." The AI will convert the voice to text and save it as a note.
        - **Text Notes:** a quick note-taking portal is provided within the App for users to enter text and image snapshots.

---

# **Phase 3: End of Voyage and Review**

 The goal of this phase is to give the user a clear end and immediate feedback.

- **End of Voyage**
    - **Necessary Features**.
        1.  The user can actively end the voyage .
        2.  A simple summary panel pops up showing the "duration" and "number of distractions" of the voyage.
- **"The Grand Map**
    
    **Necessary Function**: On a separate page, a simple route line connects completed destinations to form an expanding map. Users can see their completed routes.
    

       **Simplification**: Detailed functions such as clicking on tracks to review logs can be omitted. The core is for the user to see their "footprint" accumulating.

- Below is a description of the map and the map:

![image.png](MindBoat%2021f5155f416280f59cc8cea53829ffb8/image%2012.png)

- **Interaction:** Users can click on a section of the track to review the day's "Seagull Diary" and sailing data. (Interaction can be simpler)

- **Review (once a day)**
    - **"Seagull Diary".**
        - **Auto-generated:** App uses seagull's perspective to generate objective, third-party-like observations of the user and a summary of today's voyage to help the user discover themselves (similar to tolen's diary, which is only generated once a day).

### **To summarize: Hackathon must complete the main line**

1. **Enter the long-term goal** (the star).
2. **Create specific task** (Winds of Intention), generate destination name and associated app by LLM.
3. **Select destination, system starts logging hours, start sailing**.
4. **Implement focus detection and yaw alert mechanism during sailing** (core functionality).
5. **Provide "Back to course" and "I'm exploring" options**.
6. **Display the data summary of the voyage after finishing the voyage**.
7. **Visualization of the completed voyage path on the map**.

[ AI-generated technical process (needs to be checked)](https://www.notion.so/AI-generated-technical-process-needs-to-be-checked-21f5155f41628195adc9e212fec2a1f9?pvs=21)