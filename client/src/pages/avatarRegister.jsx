import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function AvatarRegister() {
  // track which is selected in the list/currently seeing
  const [currentIndex, setCurrentIndex] = useState(0);
  //switch for when selected, show the cutesy avatar pose
  const [isConfirmed, setIsConfirmed] = useState(false);
  const navigate = useNavigate();

  //the different avatars they can choose from!! all hand drawn by me :)
  const avatars = [
    { id: "frog", img: "/assets/avatars/frog.png", label: "The Frog" },
    { id: "fish", img: "/assets/avatars/fish.png", label: "The Fish" },
    { id: "duck", img: "/assets/avatars/duck.png", label: "The Duck" },
    { id: "wizard", img: "/assets/avatars/wizard.png", label: "The Wizard" },
    { id: "cat", img: "/assets/avatars/cat.png", label: "The Cat" },
    { id: "apple", img: "/assets/avatars/apple.png", label: "The Apple" },
    { id: "snail", img: "/assets/avatars/snail.png", label: "The Snail" },
    { id: "turtle", img: "/assets/avatars/turtle.png", label: "The Turtle" },
    {
      id: "strawberry",
      img: "/assets/avatars/strawberry.png",
      label: "The Strawberry",
    },
  ];

  //right arrow clicking to cycle through the options
  const nextAvatar = () => {
    setIsConfirmed(false); // reset to idle pose when switching
    // if at the end of the list, loop back to the start
    setCurrentIndex((prevIndex) => (prevIndex + 1) % avatars.length);
  };
  //left arrow clicking to cycle back through the options
  const prevAvatar = () => {
    setIsConfirmed(false); // reset to idle pose when switching
    // if at the start of the list, loop to the end
    setCurrentIndex(
      (prevIndex) => (prevIndex - 1 + avatars.length) % avatars.length,
    );
  };
// when user submits their choice
const handleConfirm = () => {
  setIsConfirmed(true); // show the cute pose
  try {
    //pause so they can see the pose
    setTimeout(async () => {
      await axios.post("http://localhost:5000/api/update-avatar", {
        avatarId: avatars[currentIndex].id,
      });
      navigate("/dashboard");
    }, 1500);
  } catch (err) {
    console.error("Couldn't save avatar selection", err);
    setIsConfirmed(false); // reset to idle pose if there's an error
  }
};

const current = avatars[currentIndex];

return (
  <div className="avatar-register-container">
    <h1>Choose Your Avatar</h1>
    {/* The container for the arrows and the character display */}
    <div className="carousel-container">
      {/* Left Arrow Button: Clicking this runs the 'prevAvatar' function */}
      <button className="arrow-btn" onClick={prevAvatar}>
        {" "}
        {`<`}{" "}
      </button>

      {/* The "Stage" where the character stands */}
      <div className="avatar-display">
        <img
          // If 'isConfirmed' is true, show the pose. If false, show the idle image.
          src={isConfirmed ? current.pose : current.idle}
          alt={current.label}
          // Change the CSS class based on confirmation to trigger different animations
          className={isConfirmed ? "pose-anim" : "idle-float"}
        />
        {/* Display the name of the current friend */}
        <h3>{current.label}</h3>
      </div>

      {/* Right Arrow Button: Clicking this runs the 'nextAvatar' function */}
      <button className="arrow-btn" onClick={nextAvatar}>
        {" "}
        {`>`}{" "}
      </button>
    </div>

    {/* The big button at the bottom to finalize the choice */}
    <button className="select-btn" onClick={handleConfirm}>
      {/* Change the text on the button once they click it! */}
      {isConfirmed ? "Welcome!" : "Select this character!"}
    </button>
  </div>
);
}

// Export the component so your App.js can use it
export default AvatarRegister;
