type Property = {
    progress: number;
}

export default function Bar({progress}: Property) {
    const WIDTH = 100;
    const HEIGHT = WIDTH / 10;

    return (
        <div style={{
            width: `${WIDTH}px`,
            height: `${HEIGHT}px`,
            background: "black",
            borderRadius: "0px",
            padding: "3px",
            boxSizing: "border-box",
            display: "flex",
            marginBottom: "5px"
            }}>
            <div style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "#267723",
                    borderRadius: "0px",
                }}
            />
            <div style={{
                    width: `${100 - progress}%`,
                    height: "100%",
                    background: "white",
                    borderRadius: "0px",
                }}
            />
            
            
        </div>
        
    )
}